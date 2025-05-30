#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testGitWorkflow() {
  console.log('🔍 1. 查看当前变更...');
  
  // 1. 查看变更状态
  const statusResult = await execAsync('node dist/index.js tools call git_status --params \'{"short": true}\'');
  console.log('状态结果:', JSON.parse(statusResult.stdout.split('执行结果:\n')[1]).summary);
  
  // 2. 查看具体差异
  const diffResult = await execAsync('node dist/index.js tools call git_diff --params \'{"nameOnly": true}\'');
  const diffData = JSON.parse(diffResult.stdout.split('执行结果:\n')[1]);
  console.log('📝 修改的文件:', diffData.files);
  
  if (diffData.files.length === 0) {
    console.log('✅ 没有需要提交的变更');
    return;
  }
  
  // 3. 生成提交信息 (基于文件变更的简单逻辑)
  let commitMessage = '';
  const files = diffData.files;
  
  if (files.includes('package.json')) {
    commitMessage = 'chore: 更新项目版本和描述信息';
  } else if (files.some(f => f.includes('.md'))) {
    commitMessage = 'docs: 更新文档';
  } else if (files.some(f => f.includes('src/'))) {
    commitMessage = 'feat: 更新源代码';
  } else {
    commitMessage = 'chore: 更新项目文件';
  }
  
  console.log('💭 生成的提交信息:', commitMessage);
  
  // 4. 添加文件到暂存区
  console.log('➕ 添加文件到暂存区...');
  await execAsync('node dist/index.js tools call git_add --params \'{"all": true}\'');
  
  // 5. 提交变更
  console.log('💾 提交变更...');
  const commitResult = await execAsync(`node dist/index.js tools call git_commit --params '{"message": "${commitMessage}"}'`);
  const commitData = JSON.parse(commitResult.stdout.split('执行结果:\n')[1]);
  
  console.log('✅ 提交成功!');
  console.log('   提交哈希:', commitData.commitHash);
  console.log('   文件变更:', commitData.statistics.filesChanged);
  console.log('   插入行数:', commitData.statistics.insertions);
  console.log('   删除行数:', commitData.statistics.deletions);
}

// 执行测试
testGitWorkflow().catch(console.error); 