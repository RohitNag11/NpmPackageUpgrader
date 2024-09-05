import path from "path";
import fs from "fs";
import { runCommand } from "./shellUtils";
import type { LockedDependencies, PackageJson } from "../types";
import { logError, logInfo, logSuccess } from "./consoleUtils";

type Dependencies = Record<string, string>;

// Objects to store removed dependencies and scripts
const removedLocalDeps: Dependencies = {};
const removedLocalDevDeps: Dependencies = {};
const removedLockedDeps: Dependencies = {};
const removedLockedDevDeps: Dependencies = {};
const removedScripts: Record<string, string> = {};

/**
 * Parses the error message to extract the package alias, if available.
 * 
 * @param error - The error object received from the yarn install command.
 * @returns The package alias if found, otherwise null.
 */
function parseErrorForPackageAlias(error: any): string | null {
    const patterns = [
        /https:\/\/registry\.yarnpkg\.com\/([^:]+): Not found/, 
        /error Couldn't find package "([^"]+)"/, 
        /error Couldn't find any versions for "([^"]+)" that matches/ 
    ];

    for (const pattern of patterns) {
        const match = pattern.exec(error.toString());
        if (match) {
            const decodedString = decodeURIComponent(match[1]);
            const aliasMatch = decodedString.match(/^([^\/]+)/);
            if (aliasMatch) {
                return aliasMatch[1]; // Return the alias part
            }
        }
    }
    return null;
}

/**
 * Removes dependencies that meet a specified condition and records them.
 * 
 * @param dependencies - The dependencies to be checked.
 * @param isDevDep - Whether the dependencies are devDependencies.
 * @param dependencyType - Type of dependency ("local" or "locked").
 * @param condition - A function that returns true for dependencies to be removed.
 */
function removeAndRecordDependencies(
    dependencies: Dependencies | undefined,
    isDevDep: boolean,
    dependencyType: "local" | "locked",
    condition: (name: string) => boolean
): void {
    if (!dependencies) return;

    const record = getRecord(dependencyType, isDevDep);

    for (const [name, version] of Object.entries(dependencies)) {
        if (condition(name)) {
            record[name] = version;
            delete dependencies[name];
        }
    }
}

/**
 * Retrieves the appropriate record object for storing removed dependencies.
 * 
 * @param dependencyType - Type of dependency ("local" or "locked").
 * @param isDevDep - Whether the dependencies are devDependencies.
 * @returns The record object to store removed dependencies.
 */
function getRecord(dependencyType: "local" | "locked", isDevDep: boolean): Dependencies {
    if (dependencyType === "local") {
        return isDevDep ? removedLocalDevDeps : removedLocalDeps;
    } else {
        return isDevDep ? removedLockedDevDeps : removedLockedDeps;
    }
}

/**
 * Removes dependencies that start with the specified alias and records them.
 * 
 * @param alias - The alias to match for removal.
 * @param dependencies - The dependencies to be checked.
 * @param isDevDep - Whether the dependencies are devDependencies.
 */
function removeAliasDeps(alias: string, dependencies: Dependencies | undefined, isDevDep: boolean): void {
    removeAndRecordDependencies(
        dependencies,
        isDevDep,
        "local",
        name => name.startsWith(`${alias}/`)
    );
}

/**
 * Removes locked dependencies and records them.
 * 
 * @param locked - The locked dependencies to check against.
 * @param dependencies - The dependencies to be checked.
 * @param isDevDep - Whether the dependencies are devDependencies.
 */
function removeLockedDeps(
    locked: LockedDependencies,
    dependencies: Dependencies | undefined,
    isDevDep: boolean
): void {
    removeAndRecordDependencies(
        dependencies,
        isDevDep,
        "locked",
        name => name in locked
    );
}

/**
 * Attempts to install the dependencies with retries, removing problematic packages if necessary.
 * 
 * @param packageJson - The package.json object.
 * @param projectRootPath - The root path of the project.
 * @param maxRetries - Maximum number of retries.
 */
async function attemptInstallWithRetries(
    packageJson: PackageJson,
    projectRootPath: string,
    maxRetries: number
): Promise<void> {
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            logInfo('Attempting to install dependencies...');
            await runCommand('yarn install', projectRootPath);
            logSuccess('Dependencies installed successfully!');
            break;
        } catch (error) {
            const packageAlias = parseErrorForPackageAlias(error);
            if (!packageAlias) {
                logError('Could not parse package alias from error:', error);
                break;
            }

            removeAliasDeps(packageAlias, packageJson.dependencies, false);
            removeAliasDeps(packageAlias, packageJson.devDependencies, true);

            fs.writeFileSync(path.join(projectRootPath, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf8');
            logInfo(`Removed packages starting with alias: ${packageAlias}`);
        }
        retryCount++;
    }

    if (retryCount >= maxRetries) {
        logError('Failed to resolve all package installation issues after maximum retries.');
    }
}

/**
 * Saves the removed items (dependencies and scripts) to JSON files.
 * 
 * @param exportRootPath - The path to save the JSON files.
 */
function saveRemovedItems(exportRootPath: string): void {
    const detailsPath = path.resolve(exportRootPath, 'details');

    saveJson(detailsPath, 'removedLocalPackages.json', removedLocalDeps);
    saveJson(detailsPath, 'removedLockedPackages.json', removedLockedDeps);
    saveJson(detailsPath, 'removedScripts.json', removedScripts);

    const combinedDevDeps = { ...removedLocalDevDeps, ...removedLockedDevDeps };
    const combinedDeps = { ...removedLocalDeps, ...removedLockedDeps };

    saveJson(exportRootPath, 'allRemovedItems.json', {
        scripts: removedScripts,
        localDependencies: combinedDeps,
        devDependencies: combinedDevDeps,
    });

    logSuccess(`Saved removed items to ${exportRootPath}`);
}

/**
 * Saves a JavaScript object to a JSON file.
 * 
 * @param dir - The directory where the file will be saved.
 * @param fileName - The name of the file.
 * @param data - The data to be saved.
 */
function saveJson(dir: string, fileName: string, data: object): void {
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Cleans the package.json by removing scripts and specific dependencies, then attempts to reinstall dependencies.
 * 
 * @param projectRootPath - The root path of the project.
 * @param lockedDependencies - The list of locked dependencies to remove.
 * @param exportRootPath - The path to save details of removed items.
 */
export async function cleanPackageJson(
    projectRootPath: string, 
    lockedDependencies: LockedDependencies,
    exportRootPath: string,
): Promise<void> {
    const packageJsonPath = path.join(projectRootPath, 'package.json');
    let packageJson: PackageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    removeScripts(packageJson);
    removeLockedDeps(lockedDependencies, packageJson.dependencies, false);
    removeLockedDeps(lockedDependencies, packageJson.devDependencies, true);

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');

    const maxRetries = Object.keys(packageJson.dependencies || {}).length + Object.keys(packageJson.devDependencies || {}).length;
    await attemptInstallWithRetries(packageJson, projectRootPath, maxRetries);

    saveRemovedItems(exportRootPath);
}

/**
 * Removes scripts from the package.json and records them.
 * 
 * @param packageJson - The package.json object.
 */
function removeScripts(packageJson: PackageJson): void {
    if (packageJson.scripts) {
        for (const scriptName of Object.keys(packageJson.scripts)) {
            removedScripts[scriptName] = packageJson.scripts[scriptName];
        }
        delete packageJson.scripts;
        logSuccess('Removed scripts from package.json');
    }
}
