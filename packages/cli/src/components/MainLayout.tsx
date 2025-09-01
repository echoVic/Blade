import { Box } from 'ink';
import React from 'react';
import type { AppView } from '../hooks/useAppNavigation.js';
import { ChatView } from './views/ChatView.js';
import { ConfigView } from './views/ConfigView.js';
import { HelpView } from './views/HelpView.js';
import { LogsView } from './views/LogsView.js';
import { MainView } from './views/MainView.js';
import { SettingsView } from './views/SettingsView.js';
import { ToolsView } from './views/ToolsView.js';

interface MainLayoutProps {
  currentView: AppView;
  children?: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ 
  currentView,
  children 
}) => {
  const renderCurrentView = () => {
    switch (currentView) {
      case 'main':
        return <MainView />;
      case 'settings':
        return <SettingsView />;
      case 'help':
        return <HelpView />;
      case 'logs':
        return <LogsView />;
      case 'tools':
        return <ToolsView />;
      case 'chat':
        return <ChatView />;
      case 'config':
        return <ConfigView />;
      default:
        return <MainView />;
    }
  };

  return (
    <Box 
      flexDirection="column" 
      flexGrow={1}
      paddingX={1}
      paddingY={0}
    >
      {children || renderCurrentView()}
    </Box>
  );
};