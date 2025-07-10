import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { logger } from '../../services/logService';
import { maintenanceService, MaintenanceSettings } from '../../services/maintenanceService';
import { Card, Button, Input, Textarea, Toggle } from '../ui';

const MaintenanceAdmin: React.FC = () => {
  const [settings, setSettings] = useState<MaintenanceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    isEnabled: false,
    message: 'Hệ thống đang bảo trì. Vui lòng thử lại sau.',
    allowedEmails: ''
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const currentSettings = await maintenanceService.getMaintenanceSettings();
      
      if (currentSettings) {
        setSettings(currentSettings);
        setFormData({
          isEnabled: currentSettings.isEnabled,
          message: currentSettings.message,
          allowedEmails: currentSettings.allowedEmails.join(', ')
        });
      }
    } catch (err) {
      setError('Không thể tải cài đặt bảo trì');
      logger.error('Failed to load maintenance settings', 'MaintenanceAdmin', {}, err as Error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const userResult = await supabase.auth.getUser();
      const userEmail = userResult.data.user?.email || 'unknown';
      const userName = userResult.data.user?.user_metadata?.name || userEmail;

      const allowedEmails = formData.allowedEmails
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      const success = await maintenanceService.updateMaintenanceSettings(
        formData.isEnabled,
        formData.message,
        allowedEmails,
        userEmail,
        userName
      );

      if (success) {
        setSuccess('Cài đặt bảo trì đã được cập nhật thành công');
        await loadSettings();
      } else {
        setError('Không thể cập nhật cài đặt bảo trì');
      }
    } catch (err) {
      setError('Có lỗi xảy ra khi cập nhật cài đặt');
      logger.error('Failed to update maintenance settings', 'MaintenanceAdmin', {}, err as Error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (checked: boolean) => {
    setFormData(prev => ({ ...prev, isEnabled: checked }));
  };

  if (loading) {
    return <div className="p-4">Đang tải cài đặt bảo trì...</div>;
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Quản Lý Bảo Trì
        </h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Trạng thái hiện tại:
          </span>
          <span className={`px-2 py-1 text-xs rounded ${
            settings?.isEnabled 
              ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' 
              : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
          }`}>
            {settings?.isEnabled ? 'Đang Bảo Trì' : 'Hoạt Động'}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded">
          {success}
        </div>
      )}

      <Card className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Bật Chế Độ Bảo Trì
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Khi bật, tất cả người dùng sẽ thấy trang bảo trì
              </p>
            </div>
            <Toggle 
              label=""
              checked={formData.isEnabled} 
              onChange={handleToggle}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Thông Báo Bảo Trì
            </label>
            <Textarea
              value={formData.message}
              onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
              placeholder="Nhập thông báo bảo trì..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email Được Phép Truy Cập (phân cách bằng dấu phẩy)
            </label>
            <Input
              value={formData.allowedEmails}
              onChange={(e) => setFormData(prev => ({ ...prev, allowedEmails: e.target.value }))}
              placeholder="admin@example.com, support@example.com"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Những email này sẽ vẫn có thể truy cập hệ thống trong chế độ bảo trì
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-3">
          <Button
            onClick={loadSettings}
            variant="outline"
            disabled={saving}
          >
            Làm Mới
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Đang Lưu...' : 'Lưu Cài Đặt'}
          </Button>
        </div>
      </Card>

      {settings && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Thông Tin Cập Nhật
          </h3>
                      <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div>
                <span className="font-medium">Cập nhật lần cuối:</span> {new Date(settings.updatedAt).toLocaleString('vi-VN')}
              </div>
              <div>
                <span className="font-medium">Bởi:</span> {settings.updatedByName} ({settings.updatedBy})
              </div>
              {settings.allowedEmails.length > 0 && (
                <div>
                  <span className="font-medium">Email được phép:</span> {settings.allowedEmails.join(', ')}
                </div>
              )}
            </div>
        </Card>
      )}
    </div>
  );
};

export default MaintenanceAdmin; 