import figlet from "figlet";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import { exec } from "child_process";

const program = new Command();

console.log(figlet.textSync("NPM Package Upgrader"));

program
  .version("1.0.0")
  .description("A CLI for upgrading an npm package dependency list");

/**
 * Gets the user's default editor from environment variables or falls back to a default editor.
 * 
 * @returns {string} - The user's preferred editor.
 */
function getUserDefaultEditor() {
    // Check the environment variables for EDITOR or VISUAL
    return process.env.EDITOR || process.env.VISUAL || 'code'; // Fallback to 'code' if no editor is set
}


/**
* Opens a file in the specified editor and waits for the user to save and close it.
* 
* @param {string} filePath - Path to the file to create/edit.
* @param {string} editor - The editor to open the file with (e.g., 'vim', 'nano', 'code').
* @param {function} callback - Callback function to execute after the editor is closed.
*/
function editFileInEditor(filePath: string, callback: (err?: Error, content?: string,) => void, editor: string = getUserDefaultEditor()) {
 // Ensure the file exists, creating it if necessary
 fs.writeFileSync(filePath, '', { flag: 'a' });

 // Open the file in the specified editor
 exec(`${editor} ${filePath}`, (error, stdout, stderr) => {
   if (error) {
     console.error(`Error opening the editor: ${error.message}`);
     return callback(error as Error);
   }

   if (stderr) {
     console.error(`Editor stderr: ${stderr}`);
     return callback(new Error(stderr));
   }

   console.log('User has saved and closed the file.');

   // Optionally read the file contents after the editor is closed
   const content = fs.readFileSync(filePath, 'utf-8');
   
   // Execute the callback with the file content
   callback(undefined, content);
 });
}

function setSourcePackageJson(pathName: string): void {
    console.log("Setting source package.json file...");
    const dataDir = path.resolve(__dirname, "data");
    const dataPackageJsonPath = path.join(dataDir, "package.json");

    if (!fs.existsSync(dataDir)) {
        try {
            fs.mkdirSync(dataDir);
            console.log(`Created data directory at ${dataDir}`);
        } catch (error: any) {
            console.error(`Failed to create data directory: ${error.message}`);
            return;
        }
    }

    if (fs.existsSync(dataPackageJsonPath)) {
        console.log("package.json already exists in data directory.");
        // Overwrite the file if needed (confirm with the user in a real application)
        editFileInEditor(dataPackageJsonPath, (err, content) => {
            if (err) {
              console.error('An error occurred:', err.message);
            } else {
              console.log('File content after edit:');
              console.log(content);
            }
          });
    } else {
        if (pathName) {
            const sourcePath = path.resolve(__dirname, pathName);

            if (!sourcePath.endsWith("package.json")) {
                console.error("The file is not a package.json file.");
                return;
            }

            try {
                fs.copyFileSync(sourcePath, dataPackageJsonPath);
                console.log(`Copied package.json to ${dataDir}`);
            } catch (error: any) {
                console.error(`Failed to copy package.json: ${error.message}`);
            }
        } else {
            editFileInEditor(dataPackageJsonPath, (err, content) => {
                if (err) {
                  console.error('An error occurred:', err.message);
                } else {
                  console.log('File content after edit:');
                  console.log(content);
                }
              });
        }
    }
}

program
  .command("add-source-package-json")
  .option('-p, --path <string>', 'from existing package.json file path')
  .alias("ap")
  .description("Add a source package.json file to the data directory")
  .action((options) => {
    setSourcePackageJson(options.path);
    }
    );

program.parse(process.argv);