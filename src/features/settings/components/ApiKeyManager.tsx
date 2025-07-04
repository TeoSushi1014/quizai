import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { KeyIcon, CheckCircleIcon } from '../../../constants';
import { Button, Card } from '../../../components/ui';
import { secureConfig } from '../../../services/secureConfigService';
import { logger } from '../../../services/logService';

interface ApiKeyManagerProps {
  onApiKeyUpdate?: () => void;
}

interface ApiKeyConfig {
  name: string;
  displayName: string;
  description: string;
  placeholder: string;
  pattern?: RegExp;
  required?: boolean;
}

const API_KEY_CONFIGS: ApiKeyConfig[] = [
  {
    name: 'GEMINI_API_KEY',
    displayName: 'Google Gemini API Key (Personal)',
    description: 'Optional: Use your own API key for quiz generation. Leave empty to use default system key.',
    placeholder: 'AIzaSy... (optional - leave empty to use default)',
    pattern: /^AIza[0-9A-Za-z-_]{35}$/,
    required: false
  },
];

export const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onApiKeyUpdate }) => {
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [validationStatus, setValidationStatus] = useState<Record<string, 'valid' | 'invalid' | 'unknown'>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    const keys: Record<string, string> = {};
    const status: Record<string, 'valid' | 'invalid' | 'unknown'> = {};
    
    for (const config of API_KEY_CONFIGS) {
      try {
        // Check if user has personal API key
        const personalKey = await secureConfig.getUserPersonalApiKey(config.name);
        keys[config.name] = personalKey || '';
        status[config.name] = personalKey ? 'valid' : 'unknown';
      } catch (error) {
        logger.error(`Failed to load API key: ${config.name}`, 'ApiKeyManager', {}, error as Error);
        keys[config.name] = '';
        status[config.name] = 'unknown';
      }
    }
    
    setApiKeys(keys);
    setValidationStatus(status);
  };

  const validateApiKey = (keyName: string, value: string): boolean => {
    const config = API_KEY_CONFIGS.find(c => c.name === keyName);
    if (!config) return false;
    
    if (config.required && !value.trim()) return false;
    if (config.pattern && !config.pattern.test(value)) return false;
    
    return true;
  };

  const handleKeyChange = (keyName: string, value: string) => {
    setApiKeys(prev => ({ ...prev, [keyName]: value }));
    
    // Validate key format
    const isValid = validateApiKey(keyName, value);
    setValidationStatus(prev => ({
      ...prev,
      [keyName]: value.trim() ? (isValid ? 'valid' : 'invalid') : 'unknown'
    }));
  };

  const handleSaveKey = async (keyName: string) => {
    const value = apiKeys[keyName];
    if (!value.trim()) return;

    setLoading(prev => ({ ...prev, [keyName]: true }));
    
    try {
      const success = await secureConfig.setApiKey(keyName, value);
      
      if (success) {
        setValidationStatus(prev => ({ ...prev, [keyName]: 'valid' }));
        logger.info(`API key saved successfully: ${keyName}`, 'ApiKeyManager');
        onApiKeyUpdate?.();
      } else {
        setValidationStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
        logger.error(`Failed to save API key: ${keyName}`, 'ApiKeyManager');
      }
    } catch (error) {
      logger.error(`Error saving API key: ${keyName}`, 'ApiKeyManager', {}, error as Error);
      setValidationStatus(prev => ({ ...prev, [keyName]: 'invalid' }));
    } finally {
      setLoading(prev => ({ ...prev, [keyName]: false }));
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    
    try {
      const savePromises = API_KEY_CONFIGS.map(async (config) => {
        const value = apiKeys[config.name];
        if (value?.trim()) {
          return secureConfig.setApiKey(config.name, value);
        }
        return true;
      });

      const results = await Promise.all(savePromises);
      const allSuccess = results.every(Boolean);

      if (allSuccess) {
        logger.info('All API keys saved successfully', 'ApiKeyManager');
        onApiKeyUpdate?.();
        await loadApiKeys(); // Reload to verify
      } else {
        logger.error('Some API keys failed to save', 'ApiKeyManager');
      }
    } catch (error) {
      logger.error('Error saving API keys', 'ApiKeyManager', {}, error as Error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleKeyVisibility = (keyName: string) => {
    setShowKeys(prev => ({ ...prev, [keyName]: !prev[keyName] }));
  };

  const getStatusIcon = (status: 'valid' | 'invalid' | 'unknown') => {
    switch (status) {
      case 'valid':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'invalid':
        return <span className="w-5 h-5 text-red-500">⚠️</span>;
      default:
        return <KeyIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <Card className="!bg-[var(--color-bg-surface-2)]/80 !border-[var(--color-border-default)] p-6 rounded-xl shadow-lg">
      <div className="flex items-center mb-6">
        <KeyIcon className="w-6 h-6 mr-3 text-[var(--color-primary-accent)]" />
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">
            API Key Management
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Securely store your API keys in Supabase
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {API_KEY_CONFIGS.map((config) => (
          <motion.div
            key={config.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)]">
                  {config.displayName}
                  {config.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {config.description}
                </p>
              </div>
              {getStatusIcon(validationStatus[config.name] || 'unknown')}
            </div>

            <div className="relative">
              <input
                type={showKeys[config.name] ? 'text' : 'password'}
                value={apiKeys[config.name] || ''}
                onChange={(e) => handleKeyChange(config.name, e.target.value)}
                placeholder={config.placeholder}
                className={`w-full px-4 py-3 pr-20 bg-[var(--color-bg-surface-1)] border rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-accent)] ${
                  validationStatus[config.name] === 'invalid' 
                    ? 'border-red-500' 
                    : validationStatus[config.name] === 'valid'
                    ? 'border-green-500'
                    : 'border-[var(--color-border-default)]'
                }`}
              />
              
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => toggleKeyVisibility(config.name)}
                  className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  {showKeys[config.name] ? (
                    <span className="w-5 h-5">👁️</span>
                  ) : (
                    <span className="w-5 h-5">🙈</span>
                  )}
                </button>
                
                <Button
                  onClick={() => handleSaveKey(config.name)}
                  isLoading={loading[config.name]}
                  disabled={!apiKeys[config.name]?.trim() || validationStatus[config.name] === 'invalid'}
                  size="sm"
                  variant="primary"
                  className="!py-1 !px-3"
                >
                  Save
                </Button>
              </div>
            </div>

            {validationStatus[config.name] === 'invalid' && (
              <p className="text-xs text-red-500">
                Invalid API key format. Please check your key.
              </p>
            )}
          </motion.div>
        ))}

        <div className="flex justify-end pt-4 border-t border-[var(--color-border-default)]">
          <Button
            onClick={handleSaveAll}
            isLoading={isSaving}
            variant="primary"
            size="lg"
            className="min-w-[120px]"
          >
            Save All Keys
          </Button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start space-x-3">
          <KeyIcon className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-blue-300 font-medium mb-1">How API Keys Work</p>
            <ul className="text-blue-200/80 leading-relaxed space-y-1 text-xs list-disc list-inside">
              <li><strong>Default System Key:</strong> We provide a shared API key for all users to get started</li>
              <li><strong>Personal API Key:</strong> You can add your own key to avoid rate limits and have better control</li>
              <li><strong>Priority:</strong> Your personal key (if provided) will be used first, then falls back to system default</li>
              <li><strong>Security:</strong> All keys are encrypted and stored securely. Only you can see your personal keys</li>
            </ul>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ApiKeyManager;
