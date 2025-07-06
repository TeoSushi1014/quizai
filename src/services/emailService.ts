import { supabase } from './supabaseClient'
import { logger } from './logService'
import emailjs from '@emailjs/browser'

export interface ContactMessage {
  userEmail: string;
  userName: string;
  message: string;
  userId?: string;
}

export class EmailService {
  private readonly ADMIN_EMAIL = 'teosushi1014@gmail.com';
  
  // EmailJS configuration - Cập nhật với thông tin thật từ EmailJS dashboard
  private readonly EMAILJS_SERVICE_ID = 'service_ca3qx8o'; // Service ID từ screenshot
  private readonly EMAILJS_TEMPLATE_ID = 'template_yk3zaol'; // Contact Us template từ EmailJS dashboard
  private readonly EMAILJS_PUBLIC_KEY = '3PkkqTaNztt7DEKdi'; // Public Key từ EmailJS Account → General
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
      
      // Gửi email notification đến admin sau khi lưu database thành công
      try {
        await this.sendEmailNotificationToAdmin(contactData, data.id);
        logger.info('Email notification sent successfully', 'EmailService');
      } catch (emailError) {
        logger.error('Failed to send email notification', 'EmailService', {}, emailError as Error);
        // Không return false vì message đã được lưu thành công
      }
      
      return true;
    } catch (error) {
      logger.error('Error sending contact message', 'EmailService', {}, error as Error);
      
      // Fallback to localStorage if Supabase fails
      logger.info('Using localStorage fallback for contact message', 'EmailService');
      return this.saveToLocalStorage(contactData);
    }
  }

  private async sendEmailNotificationToAdmin(contactData: ContactMessage, messageId: string): Promise<void> {
    try {
      // Prepare email template parameters
      const templateParams = {
        to_email: this.ADMIN_EMAIL,
        from_name: contactData.userName,
        from_email: contactData.userEmail,
        message: contactData.message,
        message_id: messageId,
        timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        app_url: window.location.origin
      };

      // Send email using EmailJS - Template đã được cấu hình
      const response = await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.EMAILJS_TEMPLATE_ID,
        templateParams,
        this.EMAILJS_PUBLIC_KEY
      );

      logger.info('EmailJS response received', 'EmailService', { 
        status: response.status, 
        text: response.text 
      });

      if (response.status !== 200) {
        throw new Error(`EmailJS failed with status: ${response.status}`);
      }

    } catch (error) {
      logger.error('Error in sendEmailNotificationToAdmin', 'EmailService', {}, error as Error);
      
      // Fallback to mailto
      const templateParams = {
        to_email: this.ADMIN_EMAIL,
        from_name: contactData.userName,
        from_email: contactData.userEmail,
        message: contactData.message,
        message_id: messageId,
        timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
        app_url: window.location.origin
      };
      
      this.sendMailtoFallback(templateParams);
      throw error;
    }
  }

  private sendMailtoFallback(templateParams: any): void {
    const subject = `[QuizAI] New Contact Message from ${templateParams.from_name}`;
    const body = `
New contact message received from QuizAI:

From: ${templateParams.from_name} (${templateParams.from_email})
Message ID: ${templateParams.message_id}
Timestamp: ${templateParams.timestamp}

Message:
${templateParams.message}

---
View all messages: ${templateParams.app_url}/admin/contact-messages
QuizAI Admin Panel: ${templateParams.app_url}
    `.trim();

    const mailtoUrl = `mailto:${templateParams.to_email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    // Log the mailto URL for debugging
    logger.info('Mailto fallback prepared', 'EmailService', { 
      subject,
      messagePreview: templateParams.message.substring(0, 50) + '...',
      mailtoUrl: mailtoUrl.substring(0, 100) + '...'
    });

    // Note: We don't actually open mailto here as it would be disruptive
    // Instead, we log it for debugging and admin can manually check
    console.log('📧 Email notification (mailto fallback):', { subject, body });
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
