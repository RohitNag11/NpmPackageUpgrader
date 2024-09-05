import { exec } from "child_process";

interface ExecError extends Error {
    code?: number;
}

// Helper function to run shell commands
export async function runCommand(command: string, workingDirectory: string): Promise<string> {
    return new Promise((resolve, reject) => {
        exec(command, { cwd: workingDirectory }, (error: ExecError | null, stdout: string, stderr: string) => {
        if (error) {
            console.error(`Error executing command "${command}":`, stderr);
            reject(error);
        } else {
            console.log(stdout);
            resolve(stdout);
        }
        });
    });
}