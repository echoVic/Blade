#!/usr/bin/env node

/**
 * 配置迁移 CLI 工具
 * 用于手动执行配置迁移操作
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { ConfigMigrationTool } from './ConfigMigrationTool.js';
import { CONFIG_PATHS } from '../types/index.js';

const program = new Command();
const migrationTool = new ConfigMigrationTool();

program
  .name('blade-config-migrate')
  .description('Blade 配置迁移工具')
  .version('1.0.0');

program
  .command('migrate')
  .description('执行配置迁移')
  .option('-u, --user', '仅迁移用户配置')
  .option('-p, --project', '仅迁移项目配置')
  .option('-a, --all', '迁移所有配置（默认）')
  .option('--no-backup', '不创建备份')
  .option('--dry-run', '模拟运行，不实际修改文件')
  .option('--verbose', '显示详细输出')
  .option('--force', '强制执行迁移，忽略版本检查')
  .option('--target-version <version>', '目标版本', '1.3.0')
  .action(async (options: any) => {
    try {
      console.log(chalk.blue.bold('🚀 开始配置迁移...\n'));

      const migrationOptions = {
        createBackup: !options.noBackup,
        dryRun: options.dryRun,
        verbose: options.verbose,
        force: options.force,
        targetVersion: options.targetVersion,
      };

      if (options.user) {
        console.log(chalk.yellow('📄 迁移用户配置...'));
        const result = await migrationTool.migrateUserConfig(migrationOptions);
        console.log(result);
        
        // 显示结果
        if (result.success) {
          console.log(chalk.green.bold('\n✅ 迁移完成！'));
          
          if (migrationOptions.dryRun) {
            console.log(chalk.yellow('⚠️  这是模拟运行，没有实际修改文件'));
          }
          
          if (options.backup && !migrationOptions.dryRun) {
            console.log(chalk.blue('📦 备份数据已保存'));
          }
        } else {
          console.log(chalk.red.bold('\n❌ 迁移失败！'));
        }
      } else if (options.project) {
        console.log(chalk.yellow('📁 迁移项目配置...'));
        const result = await migrationTool.migrateProjectConfig(migrationOptions);
        console.log(result);
        
        // 显示结果
        if (result.success) {
          console.log(chalk.green.bold('\n✅ 迁移完成！'));
          
          if (migrationOptions.dryRun) {
            console.log(chalk.yellow('⚠️  这是模拟运行，没有实际修改文件'));
          }
          
          if (options.backup && !migrationOptions.dryRun) {
            console.log(chalk.blue('📦 备份数据已保存'));
          }
        } else {
          console.log(chalk.red.bold('\n❌ 迁移失败！'));
          if (result.errors.length > 0) {
            console.log(chalk.red('错误信息:'));
            result.errors.forEach((error: string) => console.log(chalk.red(`  - ${error}`)));
          }
        }

        if (result.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  警告信息:'));
          result.warnings.forEach((warning: string) => console.log(chalk.yellow(`  - ${warning}`)));
        }
      } else {
        console.log(chalk.yellow('🔄 迁移所有配置...'));
        const allResults = await migrationTool.migrateAll(migrationOptions);
        console.log('\n📊 迁移结果汇总:');
        console.log(allResults.user);
        console.log(allResults.project);
        console.log('\n📋 汇总信息:');
        console.log(`总变更: ${allResults.summary.totalChanges}`);
        console.log(`总错误: ${allResults.summary.totalErrors}`);
        console.log(`总警告: ${allResults.summary.totalWarnings}`);
        console.log(`成功: ${allResults.summary.success ? chalk.green('✅') : chalk.red('❌')}`);
        
        const result = allResults.summary;
        
        // 显示结果
        if (result.success) {
          console.log(chalk.green.bold('\n✅ 迁移完成！'));
          
          if (migrationOptions.dryRun) {
            console.log(chalk.yellow('⚠️  这是模拟运行，没有实际修改文件'));
          }
          
          if (options.backup && !migrationOptions.dryRun) {
            console.log(chalk.blue('📦 备份数据已保存'));
          }
        } else {
          console.log(chalk.red.bold('\n❌ 迁移失败！'));
          const allErrors = [...allResults.user.errors, ...allResults.project.errors];
          if (allErrors.length > 0) {
            console.log(chalk.red('错误信息:'));
            allErrors.forEach((error: string) => console.log(chalk.red(`  - ${error}`)));
          }
        }

        const allWarnings = [...allResults.user.warnings, ...allResults.project.warnings];
        if (allWarnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  警告信息:'));
          allWarnings.forEach((warning: string) => console.log(chalk.yellow(`  - ${warning}`)));
        }
      }

    } catch (error) {
      console.error(chalk.red.bold('\n❌ 迁移过程中发生错误:'));
      console.error(chalk.red(error instanceof Error ? error.message : '未知错误'));
      process.exit(1);
    }
  });

program
  .command('check')
  .description('检查配置版本和迁移状态')
  .option('-v, --verbose', '显示详细信息')
  .action(async (options: any) => {
    try {
      console.log(chalk.blue.bold('🔍 检查配置状态...\n'));

      // 检查用户配置
      const userConfigPath = CONFIG_PATHS.global.userConfig;
      const userVersion = await migrationTool.detectConfigVersion(userConfigPath);
      
      console.log(chalk.cyan('👤 用户配置:'));
      console.log(`  路径: ${userConfigPath}`);
      console.log(`  版本: ${userVersion || '不存在'}`);
      
      if (userVersion && userVersion !== '1.3.0') {
        const migrations = migrationTool.getAvailableMigrations();
        const neededMigrations = migrations.filter(m => m.from === userVersion);
        
        if (neededMigrations.length > 0) {
          console.log(chalk.yellow('  需要迁移:'));
          neededMigrations.forEach(m => {
            console.log(`    - ${m.from} → ${m.to}: ${m.description}`);
          });
        }
      }

      // 检查项目配置
      const projectConfigPath = CONFIG_PATHS.project.bladeConfig;
      const projectVersion = await migrationTool.detectConfigVersion(projectConfigPath);
      
      console.log(chalk.cyan('\n📁 项目配置:'));
      console.log(`  路径: ${projectConfigPath}`);
      console.log(`  版本: ${projectVersion || '不存在'}`);
      
      if (projectVersion && projectVersion !== '1.3.0') {
        const migrations = migrationTool.getAvailableMigrations();
        const neededMigrations = migrations.filter(m => m.from === projectVersion);
        
        if (neededMigrations.length > 0) {
          console.log(chalk.yellow('  需要迁移:'));
          neededMigrations.forEach(m => {
            console.log(`    - ${m.from} → ${m.to}: ${m.description}`);
          });
        }
      }

      if (options.verbose) {
        console.log(chalk.cyan('\n🛠️  可用迁移:'));
        const allMigrations = migrationTool.getAvailableMigrations();
        allMigrations.forEach(m => {
          console.log(`  ${m.from} → ${m.to}: ${m.description}`);
        });
      }

    } catch (error) {
      console.error(chalk.red.bold('❌ 检查状态失败:'));
      console.error(chalk.red(error instanceof Error ? error.message : '未知错误'));
      process.exit(1);
    }
  });

program
  .command('backup')
  .description('创建配置备份')
  .option('-u, --user', '备份用户配置')
  .option('-p, --project', '备份项目配置')
  .option('-a, --all', '备份所有配置（默认）')
  .action(async (options: any) => {
    try {
      console.log(chalk.blue.bold('📦 创建配置备份...\n'));

      if (options.user || options.all || (!options.user && !options.project)) {
        const userConfigPath = CONFIG_PATHS.global.userConfig;
        const userVersion = await migrationTool.detectConfigVersion(userConfigPath);
        
        if (userVersion) {
          console.log(chalk.yellow('📄 备份用户配置...'));
          const backupPath = await migrationTool.createBackup(userConfigPath, userVersion, 'user');
          console.log(chalk.green(`✅ 用户配置备份完成: ${backupPath}`));
        } else {
          console.log(chalk.red('❌ 用户配置文件不存在'));
        }
      }

      if (options.project || options.all) {
        const projectConfigPath = CONFIG_PATHS.project.bladeConfig;
        const projectVersion = await migrationTool.detectConfigVersion(projectConfigPath);
        
        if (projectVersion) {
          console.log(chalk.yellow('📁 备份项目配置...'));
          const backupPath = await migrationTool.createBackup(projectConfigPath, projectVersion, 'project');
          console.log(chalk.green(`✅ 项目配置备份完成: ${backupPath}`));
        } else {
          console.log(chalk.red('❌ 项目配置文件不存在'));
        }
      }

      console.log(chalk.green.bold('\n✅ 备份完成！'));

    } catch (error) {
      console.error(chalk.red.bold('❌ 备份失败:'));
      console.error(chalk.red(error instanceof Error ? error.message : '未知错误'));
      process.exit(1);
    }
  });

program
  .command('cleanup')
  .description('清理旧备份文件')
  .option('-k, --keep <number>', '保留的备份数量', '5')
  .action(async (options: any) => {
    try {
      const keepCount = parseInt(options.keep, 10);
      
      console.log(chalk.blue.bold(`🧹 清理旧备份文件（保留 ${keepCount} 个）...\n`));
      
      const confirmation = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: '确定要清理旧备份文件吗？',
          default: false,
        },
      ]);

      if (!confirmation.proceed) {
        console.log(chalk.yellow('❌ 操作已取消'));
        return;
      }

      await migrationTool.cleanupOldBackups(keepCount);
      console.log(chalk.green.bold('✅ 清理完成！'));

    } catch (error) {
      console.error(chalk.red.bold('❌ 清理失败:'));
      console.error(chalk.red(error instanceof Error ? error.message : '未知错误'));
      process.exit(1);
    }
  });

program
  .command('interactive')
  .description('交互式迁移向导')
  .action(async () => {
    try {
      console.log(chalk.blue.bold('🎯 Blade 配置迁移向导\n'));

      // 检查当前配置状态
      console.log(chalk.yellow('🔍 检查配置状态...\n'));
      
      const userConfigPath = CONFIG_PATHS.global.userConfig;
      const projectConfigPath = CONFIG_PATHS.project.bladeConfig;
      
      const userVersion = await migrationTool.detectConfigVersion(userConfigPath);
      const projectVersion = await migrationTool.detectConfigVersion(projectConfigPath);

      console.log(chalk.cyan('👤 用户配置:'));
      console.log(`  路径: ${userConfigPath}`);
      console.log(`  版本: ${userVersion || '不存在'}\n`);
      
      console.log(chalk.cyan('📁 项目配置:'));
      console.log(`  路径: ${projectConfigPath}`);
      console.log(`  版本: ${projectVersion || '不存在'}\n`);

      // 选择迁移目标
      const { migrationTarget } = await inquirer.prompt([
        {
          type: 'list',
          name: 'migrationTarget',
          message: '选择要迁移的配置:',
          choices: [
            { name: '用户配置', value: 'user' },
            { name: '项目配置', value: 'project' },
            { name: '所有配置', value: 'all' },
          ],
        },
      ]);

      // 设置迁移选项
      const { createBackup, dryRun, verbose } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'createBackup',
          message: '是否创建备份?',
          default: true,
        },
        {
          type: 'confirm',
          name: 'dryRun',
          message: '是否模拟运行（不实际修改文件）?',
          default: false,
        },
        {
          type: 'confirm',
          name: 'verbose',
          message: '是否显示详细输出?',
          default: false,
        },
      ]);

      // 确认执行
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: '确认执行迁移?',
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow('❌ 迁移已取消'));
        return;
      }

      console.log(chalk.blue.bold('\n🚀 开始执行迁移...\n'));

      const migrationOptions = {
        createBackup,
        dryRun,
        verbose,
        force: false,
        targetVersion: '1.3.0',
      };

      if (migrationTarget === 'user') {
        const result = await migrationTool.migrateUserConfig(migrationOptions);
        
        if (result.success) {
          console.log(chalk.green.bold('✅ 迁移完成！'));
        } else {
          console.log(chalk.red.bold('❌ 迁移失败！'));
        }

        if (result.errors && result.errors.length > 0) {
          console.log(chalk.red('\n错误信息:'));
          result.errors.forEach((error: any) => console.log(chalk.red(`  - ${error}`)));
        }

        if (result.warnings && result.warnings.length > 0) {
          console.log(chalk.yellow('\n警告信息:'));
          result.warnings.forEach((warning: any) => console.log(chalk.yellow(`  - ${warning}`)));
        }
      } else if (migrationTarget === 'project') {
        const result = await migrationTool.migrateProjectConfig(migrationOptions);
        
        if (result.success) {
          console.log(chalk.green.bold('✅ 迁移完成！'));
        } else {
          console.log(chalk.red.bold('❌ 迁移失败！'));
        }

        if (result.errors && result.errors.length > 0) {
          console.log(chalk.red('\n错误信息:'));
          result.errors.forEach((error: any) => console.log(chalk.red(`  - ${error}`)));
        }

        if (result.warnings && result.warnings.length > 0) {
          console.log(chalk.yellow('\n警告信息:'));
          result.warnings.forEach((warning: any) => console.log(chalk.yellow(`  - ${warning}`)));
        }
      } else {
        const allResults = await migrationTool.migrateAll(migrationOptions);
        const result = allResults.summary;
        
        if (result.success) {
          console.log(chalk.green.bold('✅ 迁移完成！'));
        } else {
          console.log(chalk.red.bold('❌ 迁移失败！'));
        }
      }

      if (dryRun) {
        console.log(chalk.yellow('\n⚠️  这是模拟运行，没有实际修改文件'));
      }

    } catch (error) {
      console.error(chalk.red.bold('❌ 迁移失败:'));
      console.error(chalk.red(error instanceof Error ? error.message : '未知错误'));
      process.exit(1);
    }
  });

// 启动 CLI
program.parse();