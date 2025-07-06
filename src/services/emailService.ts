import { supabase } from './supabaseClient'
import { logger } from './logService'

export interface ContactMessage {
  userEmail: string;
  userName: string;
  message: string;
  userId?: string;
}

export class EmailService {
  async sendContactMessage(contactData: ContactMessage): Promise<boolean> {
    try {
      logger.info('Sending contact message', 'EmailService', { 
        userEmail: contactData.userEmail,
        userName: contactData.userName,
        messageLength: contactData.message.length
      });

      // Sử dụng Supabase để lưu message vào database thay vì gửi email trực tiếp
      // Điều này an toàn hơn và không cần cấu hình email service
      const { data, error } = await supabase
        .from('contact_messages')
        .insert([
          {
            user_email: contactData.userEmail,
            user_name: contactData.userName,
            message: contactData.message,
            user_id: contactData.userId || null,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) {
        logger.error('Failed to save contact message', 'EmailService', {
          error: error.message,
          code: error.code
        });
        
        // Nếu table chưa tồn tại, chúng ta sẽ fallback về localStorage
        if (error.code === '42P01') { // Table doesn't exist
          logger.info('Contact messages table not found, using localStorage fallback', 'EmailService');
          return this.saveToLocalStorage(contactData);
        }
        
        return false;
      }

      logger.info('Contact message saved successfully', 'EmailService', { 
        messageId: data.id 
      });
      
      return true;
    } catch (error) {
      logger.error('Error sending contact message', 'EmailService', {}, error as Error);
      
      // Fallback to localStorage if Supabase fails
      logger.info('Using localStorage fallback for contact message', 'EmailService');
      return this.saveToLocalStorage(contactData);
    }
  }

  private saveToLocalStorage(contactData: ContactMessage): boolean {
    try {
      const existingMessages = JSON.parse(localStorage.getItem('quizai_contact_messages') || '[]');
      const newMessage = {
        ...contactData,
        id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        status: 'pending'
      };
      
      existingMessages.push(newMessage);
      localStorage.setItem('quizai_contact_messages', JSON.stringify(existingMessages));
      
      logger.info('Contact message saved to localStorage', 'EmailService', { 
        messageId: newMessage.id 
      });
      
      return true;
    } catch (error) {
      logger.error('Failed to save contact message to localStorage', 'EmailService', {}, error as Error);
      return false;
    }
  }

  // Method để admin có thể lấy messages từ localStorage (nếu cần)
  getLocalMessages(): any[] {
    try {
      return JSON.parse(localStorage.getItem('quizai_contact_messages') || '[]');
    } catch (error) {
      logger.error('Failed to retrieve local contact messages', 'EmailService', {}, error as Error);
      return [];
    }
  }

  // Method để xóa messages cũ từ localStorage
  clearLocalMessages(): void {
    try {
      localStorage.removeItem('quizai_contact_messages');
      logger.info('Local contact messages cleared', 'EmailService');
    } catch (error) {
      logger.error('Failed to clear local contact messages', 'EmailService', {}, error as Error);
    }
  }
}

export const emailService = new EmailService()
