export interface PackageJson {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    scripts?: Record<string, string>;
}

  
  
export interface LockedDependencies {
    [key: string]: {
      name: string;
      version: string;
    };
  }