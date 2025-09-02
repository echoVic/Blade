// E2E 测试场景定义
// 这些场景模拟真实用户的会话式交互

export const E2E_TEST_SCENARIOS = [
  {
    name: "基础对话和帮助命令",
    commands: [
      { input: "/help", expected: /可用命令/ },
      { input: "你好，你是谁？", expected: /Blade|助手/ }
    ]
  },
  {
    name: "上下文感知审查",
    commands: [
      { input: "查看当前目录的文件", expected: /文件|目录/ },
      { input: "详细说明第一个文件", expected: /内容|代码/ }
    ]
  },
  {
    name: "多步代码生成",
    commands: [
      { input: "创建一个名为 test.js 的文件", expected: /创建|生成/ },
      { input: "在 test.js 中添加一个返回 true 的函数", expected: /function|true/ }
    ]
  },
  {
    name: "配置和状态检查",
    commands: [
      { input: "/config", expected: /配置|设置/ },
      { input: "/status", expected: /状态|运行/ }
    ]
  }
];