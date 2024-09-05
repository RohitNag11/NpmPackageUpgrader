import * as path from "path";
import * as fs from 'fs';
import { cleanPackageJson, logError, logSuccess, logWarning, logInfo } from "./utils";
import type { LockedDependencies } from "./types";

// Base directories for projects
const cliAppRootDir = path.resolve(__dirname, '..');
const npmPackageUpgraderRootDir = path.resolve(cliAppRootDir, '..');
const dummyNpmProjectRootDir = path.join(npmPackageUpgraderRootDir, 'dummyNpmProject');

// Data paths
const dataDir = path.join(cliAppRootDir, 'data');
const outputDataDir = path.join(dataDir, 'output');
const cleanedItemsDir = path.join(outputDataDir, 'cleaned-items');
const inputDataDir = path.join(dataDir, 'input');

// Path to the source package.json
const lockedDepsPath = path.join(inputDataDir, 'lockedDependencies.js');
const srcPackageJsonPath = path.join(inputDataDir, 'package.json');

// Path to the dummy NPM project directory
const dummyNpmProjectPackageJsonPath = path.join(dummyNpmProjectRootDir, 'package.json');

async function setupProject() {
    let lockedDependencies: LockedDependencies = {};
    try {
      lockedDependencies = require(lockedDepsPath);
    } catch (error) {
      logWarning('No locked dependencies set');
      return;
    }
    try {
      // Copy package.json
      fs.copyFile(srcPackageJsonPath, dummyNpmProjectPackageJsonPath, (err) => {
        if (err) throw err;
        logSuccess(`package.json was copied to ${dummyNpmProjectPackageJsonPath}`);
        logInfo('Cleaning package.json...');
        cleanPackageJson(
            dummyNpmProjectRootDir, 
            lockedDependencies,
            cleanedItemsDir,
        );
        logSuccess('Project setup and execution completed!');
      });
    } catch (error) {
      logError('Error setting up the project:', error);
    }
  }

setupProject();
