// extension.js

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Global state
let statusBarItem;
let outputChannel;
let fileWatcher;
let isInstalling = false;

// 1. activate() - Extension entry point
function activate(context) {
  // Initialize logging
  logToOutputChannel('Auto Dependency Installer activated');

  // Create status bar item
  statusBarItem = createStatusBarItem();
  context.subscriptions.push(statusBarItem);

  // Initialize output channel
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('Auto Dependency Installer');
    context.subscriptions.push(outputChannel);
  }

  // Show initial status
  updateStatusBar('⚙️ Initializing...');

  // Register commands
  const installCommand = vscode.commands.registerCommand(
    'auto-dependency-installer.installDependencies',
    triggerAutoInstall
  );
  context.subscriptions.push(installCommand);

  const configureCommand = vscode.commands.registerCommand(
    'auto-dependency-installer.configure',
    () => {
      vscode.commands.executeCommand('workbench.action.openSettings', 'autoDependencyInstaller');
    }
  );
  context.subscriptions.push(configureCommand);

  // Register file watcher for package.json
  registerFileWatcher();
  context.subscriptions.push({
    dispose: () => {
      if (fileWatcher) fileWatcher.dispose();
    },
  });

  // Initial check for dependencies if a workspace is open
  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    setTimeout(() => {
      triggerAutoInstall();
    }, 2000); // Delay initial check to avoid slowing down extension activation
  }

  logToOutputChannel('Auto Dependency Installer initialized successfully');
  updateStatusBar('✅ Ready');
}

// 2. deactivate() - Extension cleanup
function deactivate() {
  if (statusBarItem) {
    statusBarItem.dispose();
  }

  if (fileWatcher) {
    fileWatcher.dispose();
  }

  if (outputChannel) {
    outputChannel.dispose();
  }

  logToOutputChannel('Auto Dependency Installer deactivated');
}

// 14. createStatusBarItem() - Create VS Code status bar element
function createStatusBarItem() {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.command = 'auto-dependency-installer.installDependencies';
  item.tooltip = 'Auto Dependency Installer';
  item.text = '$(package) Dependencies';
  item.show();
  return item;
}

// 15. updateStatusBar(message) - Update status bar with current state
function updateStatusBar(message) {
  if (statusBarItem) {
    switch (message) {
      case '✅ Dependencies ready':
        statusBarItem.text = '$(check) Dependencies';
        statusBarItem.backgroundColor = undefined;
        break;
      case '🔧 Installing...':
        statusBarItem.text = '$(sync~spin) Installing dependencies...';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        break;
      case '❌ Install failed':
        statusBarItem.text = '$(error) Dependencies';
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        break;
      case '❌ No package.json':
        statusBarItem.text = '$(warning) No package.json';
        statusBarItem.backgroundColor = undefined;
        break;
      case '⏩ Install skipped':
        statusBarItem.text = '$(circle-slash) Dependencies skipped';
        statusBarItem.backgroundColor = undefined;
        break;
      case '⚙️ Initializing...':
        statusBarItem.text = '$(loading~spin) Dependencies initializing...';
        statusBarItem.backgroundColor = undefined;
        break;
      default:
        statusBarItem.text = `$(package) ${message}`;
        statusBarItem.backgroundColor = undefined;
    }
  }
}

// 16. logToOutputChannel(message) - Log messages to extension output
function logToOutputChannel(message, show = false) {
  if (outputChannel) {
    const timestamp = new Date().toLocaleTimeString();
    outputChannel.appendLine(`[${timestamp}] ${message}`);
    if (show) {
      outputChannel.show();
    }
  }
}

// 13. getWorkspaceConfig() - Read extension configuration
function getWorkspaceConfig() {
  return vscode.workspace.getConfiguration('autoDependencyInstaller');
}

// 12. registerFileWatcher(filePath) - Watch for package.json change
function registerFileWatcher() {
  if (fileWatcher) {
    fileWatcher.dispose();
  }

  const packageJsonGlob = new vscode.RelativePattern(
    vscode.workspace.workspaceFolders?.[0] || '',
    '**/package.json'
  );

  fileWatcher = vscode.workspace.createFileSystemWatcher(packageJsonGlob);

  fileWatcher.onDidCreate(triggerAutoInstall);
  fileWatcher.onDidChange(triggerAutoInstall);

  logToOutputChannel('File watcher registered for package.json files');
}

// 3. checkPackageJson() - Verify package.json exists
function checkPackageJson() {
  if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
    logToOutputChannel('No workspace folder open');
    return false;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  const packageJsonPath = path.join(workspaceRoot, 'package.json');

  if (!fs.existsSync(packageJsonPath)) {
    logToOutputChannel('No package.json found in workspace root');
    return false;
  }

  return true;
}

// 4. parseDependencies() - Extract dependencies from package.json
function parseDependencies() {
  try {
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const packageJsonPath = path.join(workspaceRoot, 'package.json');

    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    logToOutputChannel(
      `Found ${Object.keys(dependencies).length} dependencies and ${
        Object.keys(devDependencies).length
      } devDependencies`
    );

    return {
      dependencies,
      devDependencies,
      packageJson,
    };
  } catch (error) {
    logToOutputChannel(`Error parsing package.json: ${error.message}`, true);
    return {
      dependencies: {},
      devDependencies: {},
      packageJson: {},
    };
  }
}

// 17. verifyNodeModules() - Check if node_modules exists and is valid
function verifyNodeModules() {
  try {
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const nodeModulesPath = path.join(workspaceRoot, 'node_modules');

    if (!fs.existsSync(nodeModulesPath)) {
      logToOutputChannel('node_modules directory not found');
      return false;
    }

    // Check if node_modules is a directory
    const stats = fs.statSync(nodeModulesPath);
    if (!stats.isDirectory()) {
      logToOutputChannel('node_modules is not a directory');
      return false;
    }

    logToOutputChannel('node_modules directory verified');
    return true;
  } catch (error) {
    logToOutputChannel(`Error verifying node_modules: ${error.message}`);
    return false;
  }
}

// 18. compareWithInstalled() - Get list of currently installed packages
function compareWithInstalled(parsedDeps) {
  try {
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const nodeModulesPath = path.join(workspaceRoot, 'node_modules');

    const installedDependencies = {};

    // Check regular dependencies
    for (const dep in parsedDeps.dependencies) {
      const depPath = path.join(nodeModulesPath, dep);

      if (fs.existsSync(depPath)) {
        try {
          // Try to read the package.json of the installed dependency
          const depPackagePath = path.join(depPath, 'package.json');

          if (fs.existsSync(depPackagePath)) {
            const depPackageJson = JSON.parse(fs.readFileSync(depPackagePath, 'utf-8'));
            installedDependencies[dep] = depPackageJson.version;
          } else {
            installedDependencies[dep] = 'unknown';
          }
        } catch (error) {
          installedDependencies[dep] = 'error';
        }
      }
    }

    // Check dev dependencies
    for (const dep in parsedDeps.devDependencies) {
      const depPath = path.join(nodeModulesPath, dep);

      if (fs.existsSync(depPath)) {
        try {
          // Try to read the package.json of the installed dependency
          const depPackagePath = path.join(depPath, 'package.json');

          if (fs.existsSync(depPackagePath)) {
            const depPackageJson = JSON.parse(fs.readFileSync(depPackagePath, 'utf-8'));
            installedDependencies[dep] = depPackageJson.version;
          } else {
            installedDependencies[dep] = 'unknown';
          }
        } catch (error) {
          installedDependencies[dep] = 'error';
        }
      }
    }

    logToOutputChannel(`Found ${Object.keys(installedDependencies).length} installed dependencies`);

    return installedDependencies;
  } catch (error) {
    logToOutputChannel(`Error comparing installed dependencies: ${error.message}`);
    return {};
  }
}

// 6. validateDependencies(parsedDeps, installedDeps) - Compare and identify missing deps
function validateDependencies(parsedDeps, installedDeps) {
  const missingDeps = {
    dependencies: {},
    devDependencies: {},
  };

  // Check regular dependencies
  for (const dep in parsedDeps.dependencies) {
    if (!installedDeps[dep]) {
      missingDeps.dependencies[dep] = parsedDeps.dependencies[dep];
    }
  }

  // Check dev dependencies
  for (const dep in parsedDeps.devDependencies) {
    if (!installedDeps[dep]) {
      missingDeps.devDependencies[dep] = parsedDeps.devDependencies[dep];
    }
  }

  const missingDepsCount =
    Object.keys(missingDeps.dependencies).length + Object.keys(missingDeps.devDependencies).length;

  logToOutputChannel(`Found ${missingDepsCount} missing dependencies`);

  return missingDeps;
}

// 19. fetchPackageVersions(packages) - Optional version validation
async function fetchPackageVersions(missingDeps) {
  const config = getWorkspaceConfig();

  // Skip version check if disabled in settings
  if (!config.validateVersions) {
    logToOutputChannel('Version validation skipped (disabled in settings)');
    return missingDeps;
  }

  logToOutputChannel('Validating package versions...');

  const validatedDeps = {
    dependencies: { ...missingDeps.dependencies },
    devDependencies: { ...missingDeps.devDependencies },
  };

  // Use npm to validate versions - this is a simple implementation
  try {
    // Process in batches to avoid command line length limits
    const allDeps = [
      ...Object.keys(missingDeps.dependencies),
      ...Object.keys(missingDeps.devDependencies),
    ];

    if (allDeps.length === 0) {
      return validatedDeps;
    }

    // Only check a few packages to avoid overloading npm registry
    const depsToCheck = allDeps.slice(0, 5);

    const { stdout } = await execPromise(`npm info ${depsToCheck.join(' ')} version --json`);
    const versionInfo = JSON.parse(stdout);

    // For single package result, npm returns just the version string
    if (typeof versionInfo === 'string') {
      const singlePackage = depsToCheck[0];
      logToOutputChannel(`Validated version for ${singlePackage}: ${versionInfo}`);
    }
    // For multiple packages, npm returns an object with package names as keys
    else {
      for (const pkg in versionInfo) {
        logToOutputChannel(`Validated version for ${pkg}: ${versionInfo[pkg]}`);
      }
    }
  } catch (error) {
    logToOutputChannel(`Error validating versions: ${error.message}`);
  }

  return validatedDeps;
}

// 5. detectPackageManager() - Identify which package manager to use
function detectPackageManager() {
  try {
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

    // Check lock files for package manager detection
    const hasPackageLock = fs.existsSync(path.join(workspaceRoot, 'package-lock.json'));
    const hasYarnLock = fs.existsSync(path.join(workspaceRoot, 'yarn.lock'));
    const hasPnpmLock = fs.existsSync(path.join(workspaceRoot, 'pnpm-lock.yaml'));
    const hasBowerJson = fs.existsSync(path.join(workspaceRoot, 'bower.json'));
    const hasBunLockb = fs.existsSync(path.join(workspaceRoot, 'bun.lockb'));

    // Check for volta config
    const hasVolta =
      fs.existsSync(path.join(workspaceRoot, 'volta.json')) ||
      (fs.existsSync(path.join(workspaceRoot, 'package.json')) &&
        JSON.parse(fs.readFileSync(path.join(workspaceRoot, 'package.json'), 'utf8')).volta);

    // User preference from settings
    const config = getWorkspaceConfig();
    if (config.preferredPackageManager && config.preferredPackageManager !== 'auto') {
      logToOutputChannel(`Using preferred package manager: ${config.preferredPackageManager}`);
      return config.preferredPackageManager;
    }

    // Auto-detect
    if (hasBunLockb) {
      logToOutputChannel('Detected bun as package manager (bun.lockb)');
      return 'bun';
    } else if (hasPnpmLock) {
      logToOutputChannel('Detected pnpm as package manager (pnpm-lock.yaml)');
      return 'pnpm';
    } else if (hasYarnLock) {
      logToOutputChannel('Detected yarn as package manager (yarn.lock)');
      return 'yarn';
    } else if (hasPackageLock) {
      logToOutputChannel('Detected npm as package manager (package-lock.json)');
      return 'npm';
    } else if (hasBowerJson) {
      logToOutputChannel('Detected bower as package manager (bower.json)');
      return 'bower';
    } else if (hasVolta) {
      logToOutputChannel('Detected volta in project configuration');
      return 'volta run npm';
    }

    // Default to npm
    logToOutputChannel('No specific package manager detected, using npm');
    return 'npm';
  } catch (error) {
    logToOutputChannel(`Error detecting package manager: ${error.message}`);
    return 'npm';
  }
}

// 21. generateInstallCommand()
function generateInstallCommand(packageManager, missingDeps) {
  const depsArray = Object.keys(missingDeps.dependencies);
  const devDepsArray = Object.keys(missingDeps.devDependencies);

  // Skip if no missing dependencies
  if (depsArray.length === 0 && devDepsArray.length === 0) {
    return '';
  }

  // Commands for different package managers
  switch (packageManager) {
    case 'yarn':
      return [
        ...(depsArray.length > 0 ? [`yarn add ${depsArray.join(' ')}`] : []),
        ...(devDepsArray.length > 0 ? [`yarn add -D ${devDepsArray.join(' ')}`] : []),
      ].join(' && ');

    case 'pnpm':
      return [
        ...(depsArray.length > 0 ? [`pnpm add ${depsArray.join(' ')}`] : []),
        ...(devDepsArray.length > 0 ? [`pnpm add -D ${devDepsArray.join(' ')}`] : []),
      ].join(' && ');

    case 'bower':
      return [
        ...(depsArray.length > 0 ? [`bower install ${depsArray.join(' ')} --save`] : []),
        ...(devDepsArray.length > 0 ? [`bower install ${devDepsArray.join(' ')} --save-dev`] : []),
      ].join(' && ');

    case 'bun':
      return [
        ...(depsArray.length > 0 ? [`bun add ${depsArray.join(' ')}`] : []),
        ...(devDepsArray.length > 0 ? [`bun add -d ${devDepsArray.join(' ')}`] : []),
      ].join(' && ');

    case 'volta run npm':
      return [
        ...(depsArray.length > 0 ? [`volta run npm install ${depsArray.join(' ')}`] : []),
        ...(devDepsArray.length > 0 ? [`volta run npm install -D ${devDepsArray.join(' ')}`] : []),
      ].join(' && ');

    case 'jspm':
      return [
        ...(depsArray.length > 0 ? [`jspm install ${depsArray.join(' ')}`] : []),
        ...(devDepsArray.length > 0 ? [`jspm install --dev ${devDepsArray.join(' ')}`] : []),
      ].join(' && ');

    case 'ied':
      return [
        ...(depsArray.length > 0 ? [`ied install ${depsArray.join(' ')}`] : []),
        ...(devDepsArray.length > 0 ? [`ied install --save-dev ${devDepsArray.join(' ')}`] : []),
      ].join(' && ');

    case 'cnpm':
      return [
        ...(depsArray.length > 0 ? [`cnpm install ${depsArray.join(' ')}`] : []),
        ...(devDepsArray.length > 0 ? [`cnpm install -D ${devDepsArray.join(' ')}`] : []),
      ].join(' && ');

    case 'ntl':
      return [
        ...(depsArray.length > 0 ? [`ntl install ${depsArray.join(' ')}`] : []),
        ...(devDepsArray.length > 0 ? [`ntl install -D ${devDepsArray.join(' ')}`] : []),
      ].join(' && ');

    case 'tnpm':
      return [
        ...(depsArray.length > 0 ? [`tnpm install ${depsArray.join(' ')}`] : []),
        ...(devDepsArray.length > 0 ? [`tnpm install --save-dev ${devDepsArray.join(' ')}`] : []),
      ].join(' && ');

    case 'corepack':
      return [
        ...(depsArray.length > 0 ? [`corepack npm install ${depsArray.join(' ')}`] : []),
        ...(devDepsArray.length > 0 ? [`corepack npm install -D ${devDepsArray.join(' ')}`] : []),
      ].join(' && ');

    case 'npm':
    default:
      return [
        ...(depsArray.length > 0 ? [`npm install ${depsArray.join(' ')}`] : []),
        ...(devDepsArray.length > 0 ? [`npm install -D ${devDepsArray.join(' ')}`] : []),
      ].join(' && ');
  }
}

// 9. executeShellCommand(command) - Run package manager commands
async function executeShellCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    logToOutputChannel(`Executing command: ${command}`);

    const child = exec(command, { cwd }, (error, stdout, stderr) => {
      if (error) {
        logToOutputChannel(`Command error: ${error.message}`, true);
        logToOutputChannel(`stderr: ${stderr}`, true);
        reject(error);
        return;
      }

      logToOutputChannel(`Command output: ${stdout.trim()}`);
      resolve({ stdout, stderr });
    });

    // Stream output to the output channel
    if (child.stdout) {
      child.stdout.on('data', (data) => {
        logToOutputChannel(`[stdout] ${data.toString().trim()}`);
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        logToOutputChannel(`[stderr] ${data.toString().trim()}`);
      });
    }
  });
}

// 10. handleInstallSuccess() - Process successful installation
function handleInstallSuccess() {
  isInstalling = false;
  logToOutputChannel('Dependencies installed successfully', true);
  updateStatusBar('✅ Dependencies ready');

  // Notify user
  vscode.window.showInformationMessage('Dependencies installed successfully');
}

// 11. handleInstallError(error) - Handle installation failures
function handleInstallError(error) {
  isInstalling = false;
  logToOutputChannel(`Installation failed: ${error.message}`, true);
  updateStatusBar('❌ Install failed');

  // Notify user
  vscode.window.showErrorMessage(`Failed to install dependencies: ${error.message}`);
}

// 8. showInstallPrompt(missingDeps) - Ask user for installation confirmation
async function showInstallPrompt(missingDeps) {
  const depsCount = Object.keys(missingDeps.dependencies).length;
  const devDepsCount = Object.keys(missingDeps.devDependencies).length;

  const totalCount = depsCount + devDepsCount;

  if (totalCount === 0) {
    return false;
  }

  let message = `Found ${totalCount} missing ${
    totalCount === 1 ? 'dependency' : 'dependencies'
  }. Install now?`;

  // For small number of packages, show them in the message
  if (totalCount <= 5) {
    const allDeps = [
      ...Object.keys(missingDeps.dependencies),
      ...Object.keys(missingDeps.devDependencies),
    ];
    message = `Missing ${totalCount} ${
      totalCount === 1 ? 'dependency' : 'dependencies'
    }: ${allDeps.join(', ')}. Install now?`;
  }

  const installAction = 'Install';
  const skipAction = 'Skip';
  const showDetailsAction = 'Show Details';
  const configureAction = 'Configure Auto-Install';

  const result = await vscode.window.showInformationMessage(
    message,
    { modal: false },
    installAction,
    skipAction,
    showDetailsAction,
    configureAction
  );

  if (result === installAction) {
    return true;
  } else if (result === showDetailsAction) {
    // Show missing dependencies in output channel
    logToOutputChannel('Missing dependencies:', true);

    if (depsCount > 0) {
      logToOutputChannel('Dependencies:', true);
      for (const dep in missingDeps.dependencies) {
        logToOutputChannel(`  - ${dep}: ${missingDeps.dependencies[dep]}`, true);
      }
    }

    if (devDepsCount > 0) {
      logToOutputChannel('Dev Dependencies:', true);
      for (const dep in missingDeps.devDependencies) {
        logToOutputChannel(`  - ${dep}: ${missingDeps.devDependencies[dep]}`, true);
      }
    }

    // Ask again after showing details
    return showInstallPrompt(missingDeps);
  } else if (result === configureAction) {
    vscode.commands.executeCommand('workbench.action.openSettings', 'autoDependencyInstaller');
    return false;
  } else {
    return false;
  }
}

// 7. installMissingDependencies(missingDeps) - Install missing packages
async function installMissingDependencies(missingDeps) {
  try {
    // Check if already installing
    if (isInstalling) {
      logToOutputChannel('Installation already in progress, skipping');
      return false;
    }

    isInstalling = true;
    updateStatusBar('🔧 Installing...');

    // Get the workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;

    // Detect package manager
    const packageManager = detectPackageManager();

    // Generate install command
    const installCommand = generateInstallCommand(packageManager, missingDeps);

    if (!installCommand) {
      logToOutputChannel('No dependencies to install');
      isInstalling = false;
      updateStatusBar('✅ Dependencies ready');
      return true;
    }

    // Show progress notification
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Installing dependencies with ${packageManager}`,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ increment: 0 });

        try {
          await executeShellCommand(installCommand, workspaceRoot);
          progress.report({ increment: 100 });
          handleInstallSuccess();
          return true;
        } catch (error) {
          handleInstallError(error);
          return false;
        }
      }
    );

    return true;
  } catch (error) {
    handleInstallError(error);
    return false;
  }
}

// 20. triggerAutoInstall() - Main workflow coordinator
async function triggerAutoInstall() {
  try {
    // Avoid running multiple times simultaneously
    if (isInstalling) {
      logToOutputChannel('Installation already in progress, skipping trigger');
      return;
    }

    logToOutputChannel('Triggering auto dependency check');

    // Check if package.json exists
    if (!checkPackageJson()) {
      updateStatusBar('❌ No package.json');
      return;
    }

    // Parse dependencies from package.json
    const parsedDeps = parseDependencies();

    // Verify node_modules directory
    const hasNodeModules = verifyNodeModules();

    // Get installed dependencies
    const installedDeps = hasNodeModules ? compareWithInstalled(parsedDeps) : {};

    // Validate dependencies (find missing ones)
    const missingDeps = validateDependencies(parsedDeps, installedDeps);

    const missingDepsCount =
      Object.keys(missingDeps.dependencies).length +
      Object.keys(missingDeps.devDependencies).length;

    // If no missing dependencies, update status and return
    if (missingDepsCount === 0) {
      logToOutputChannel('All dependencies are already installed');
      updateStatusBar('✅ Dependencies ready');
      return;
    }

    // Optional version validation
    const validatedMissingDeps = await fetchPackageVersions(missingDeps);

    // Check auto-install preference
    const config = getWorkspaceConfig();

    if (config.autoInstall) {
      logToOutputChannel('Auto-install is enabled, installing missing dependencies');
      await installMissingDependencies(validatedMissingDeps);
    } else {
      logToOutputChannel('Auto-install is disabled, showing prompt');
      const shouldInstall = await showInstallPrompt(validatedMissingDeps);

      if (shouldInstall) {
        await installMissingDependencies(validatedMissingDeps);
      } else {
        logToOutputChannel('Installation skipped by user');
        updateStatusBar('⏩ Install skipped');
      }
    }
  } catch (error) {
    logToOutputChannel(`Error in auto-install workflow: ${error.message}`, true);
    updateStatusBar('❌ Error');
    isInstalling = false;
  }
}

module.exports = {
  activate,
  deactivate,
};
