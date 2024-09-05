const successFormat = [ 'color: green' ].join(';');
// const errorFormat = [ 'color: red' ].join(';');
const warningFormat = [ 'color: orange' ].join(';');

export function logSuccess(message: string): void {
    console.log(`%c${message}`, successFormat);
}

export function logError(message: string, err?: any): void {
    console.error(`${message}`, err);
}

export function logWarning(message: string): void {
    console.warn(`%c${message}`, warningFormat);
}

export function logInfo(message: string): void {
    console.info(message);
}