# <div align="center"> <br> A U T O - D E P E N D E N C Y - I N S T A L L E R <br> <br> </div>

###### <div align="center"> [![Version](https://img.shields.io/visual-studio-marketplace/v/GIRISHKOR.auto-dependency-installer?label=Version&color=007bff&style=flat&logo=visual-studio-code)](https://marketplace.visualstudio.com/items?itemName=GIRISHKOR.auto-dependency-installer) [![Downloads](https://img.shields.io/visual-studio-marketplace/d/GIRISHKOR.auto-dependency-installer?label=Downloads&color=28a745&style=flat&logo=download)](https://marketplace.visualstudio.com/items?itemName=GIRISHKOR.auto-dependency-installer) [![GitHub Stars](https://img.shields.io/github/stars/girish-kor/auto-dependency-installer?style=flat&label=Stars&color=6f42c1&logo=github)](https://github.com/girish-kor/auto-dependency-installer) [![License](https://img.shields.io/badge/License-MIT-17a2b8?style=flat&logo=openjdk)](https://opensource.org/licenses/MIT) </div>

### <div align="center">**Automatically detect and install missing dependencies for your project directly from Visual Studio Code!**</div>

---

## ➩ Quick Guide

1. **Open your project** in Visual Studio Code
2. **Trigger installation** using any method:
   - **Command Palette** : <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>/<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
   - **Enter** : >Install dependencies **OR** >Configure Auto Dependency Installer
   - **Notification** : Install, Skip, Show Details, Configure Auto-Install

---

## ➩ Supported Package Managers

| **Package Manager** | **Lock File**       | **Installation Command**         |
| :-----------------: | :------------------ | :------------------------------- |
|       **npm**       | `package-lock.json` | `npm install <package>`          |
|      **yarn**       | `yarn.lock`         | `yarn add <package>`             |
|      **pnpm**       | `pnpm-lock.yaml`    | `pnpm add <package>`             |
|       **bun**       | `bun.lockb`         | `bun add <package>`              |
|      **bower**      | `bower.json`        | `bower install <package>`        |
|      **volta**      | `volta.json`        | `volta run npm install`          |
|      **jspm**       | _N/A_               | `jspm install <package>`         |
|       **ied**       | _N/A_               | `ied install <package>`          |
|      **cnpm**       | _N/A_               | `cnpm install <package>`         |
|       **ntl**       | _N/A_               | `ntl install <package>`          |
|      **tnpm**       | _N/A_               | `tnpm install <package>`         |
|    **corepack**     | _N/A_               | `corepack npm install <package>` |

_Managers without lock file support can be configured as default in settings_

---

## ➩ Configuration

Add to `settings.json`:

```json
{
  "auto-dependency-installer.preferredPackageManager": "npm",
  "auto-dependency-installer.autoDetect": true
}
```

- **`preferredPackageManager`**: Fallback when no lock file detected
- **`autoDetect`**: Enable/disable automatic lock file detection

---

## ❓ FAQ

**Q: How does it detect missing dependencies?**  
A: Analyzes import statements vs package.json dependencies

**Q: Can I use it with monorepos?**  
A: Yes! Works at the workspace level

**Q: Does it support global installations?**  
A: Currently focuses on project-local dependencies

---

##### <div align="center"> 🛠 Maintained by [Girish Kor](https://github.com/girish-kor) | 💖 Support by starring [the repo](https://github.com/girish-kor/auto-dependency-installer)! </div>
