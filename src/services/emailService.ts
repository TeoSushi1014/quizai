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
  private readonly EMAILJS_SERVICE_ID = 'service_ca3qx8o';
  private readonly EMAILJS_TEMPLATE_ID = 'template_yk32a0i';
  private readonly EMAILJS_AUTO_REPLY_TEMPLATE_ID = 'template_zxpohea';
  private readonly EMAILJS_PUBLIC_KEY = '3PkkqTaNztt7DEKdi';
  
  private getSimpleTemplateParams(contactData: ContactMessage, messageId: string) {
    return {
      name: contactData.userName,
      email: contactData.userEmail,
      message: contactData.message,
      title: `New Contact Message from ${contactData.userName}`,
      message_id: messageId,
      timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      from_name: contactData.userName,
      from_email: contactData.userEmail,
      reply_to: contactData.userEmail
    };
  }

  private getAutoReplyTemplateParams(contactData: ContactMessage, messageId: string) {
    return {
      to_name: contactData.userName,
      to_email: contactData.userEmail,
      user_name: contactData.userName,
      user_email: contactData.userEmail,
      to: contactData.userEmail,
      name: contactData.userName,
      email: contactData.userEmail,
      message_id: messageId,
      timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      admin_email: this.ADMIN_EMAIL,
      app_name: 'QuizAI',
      app_url: window.location.origin
    };
  }

  async sendContactMessage(contactData: ContactMessage): Promise<boolean> {
    try {
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
        
        if (error.code === '42P01') {
          return this.saveToLocalStorage(contactData);
        }
        
        return false;
      }
      
      let emailSent = false;
      try {
        await this.sendEmailNotificationToAdmin(contactData, data.id);
        emailSent = true;
      } catch (emailError) {
        logger.error('Failed to send admin email notification', 'EmailService', {
          willUseFallback: true,
          messageStillSaved: true
        }, emailError as Error);
        emailSent = false;
      }

      let autoReplySent = false;
      try {
        await this.sendAutoReplyToUser(contactData, data.id);
        autoReplySent = true;
      } catch (autoReplyError) {
        logger.error('Failed to send auto-reply email to user', 'EmailService', {
          willContinueAnyway: true,
          messageStillSaved: true,
          adminEmailStatus: emailSent ? 'sent' : 'failed'
        }, autoReplyError as Error);
        autoReplySent = false;
      }
      
      return true;
    } catch (error) {
      logger.error('Error sending contact message', 'EmailService', {}, error as Error);
      return this.saveToLocalStorage(contactData);
    }
  }

  private async sendEmailNotificationToAdmin(contactData: ContactMessage, messageId: string): Promise<void> {
    try {
      const templateParams = this.getSimpleTemplateParams(contactData, messageId);

      const response = await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.EMAILJS_TEMPLATE_ID,
        templateParams,
        this.EMAILJS_PUBLIC_KEY
      );

      if (response.status !== 200) {
        throw new Error(`EmailJS failed with status: ${response.status}, text: ${response.text}`);
      }

    } catch (error) {
      const err = error as any;
      logger.error('Error in sendEmailNotificationToAdmin', 'EmailService', {
        errorMessage: err.message,
        errorStatus: err.status,
        errorText: err.text,
        errorResponse: err.response
      }, error as Error);
      
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

  private async sendAutoReplyToUser(contactData: ContactMessage, messageId: string): Promise<void> {
    try {
      const templateParams = this.getAutoReplyTemplateParams(contactData, messageId);

      if (!contactData.userEmail || !contactData.userEmail.includes('@')) {
        throw new Error(`Invalid recipient email: ${contactData.userEmail}`);
      }

      const response = await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.EMAILJS_AUTO_REPLY_TEMPLATE_ID,
        templateParams,
        this.EMAILJS_PUBLIC_KEY
      );

      if (response.status !== 200) {
        throw new Error(`EmailJS auto-reply failed with status: ${response.status}, text: ${response.text}`);
      }

    } catch (error) {
      logger.error('Error in sendAutoReplyToUser', 'EmailService', {
        recipientEmail: contactData.userEmail,
        messageId: messageId
      }, error as Error);
      throw error;
    }
  }

  private sendMailtoFallback(templateParams: any): void {
    try {
      const subject = encodeURIComponent('New Contact Message');
      const body = encodeURIComponent(
        `From: ${templateParams.from_name} (${templateParams.from_email})\n` +
        `Message ID: ${templateParams.message_id}\n` +
        `Time: ${templateParams.timestamp}\n\n` +
        `${templateParams.message}\n\n` +
        `---\n` +
        `This is a fallback email. The original message is saved in the database.\n` +
        `View in app: ${templateParams.app_url}`
      );
      
      const mailtoLink = `mailto:${templateParams.to_email}?subject=${subject}&body=${body}`;
      window.open(mailtoLink, '_blank');
    } catch (error) {
      logger.error('Error in sendMailtoFallback', 'EmailService', {}, error as Error);
    }
  }

  private saveToLocalStorage(contactData: ContactMessage): boolean {
    try {
      const messages = this.getLocalMessages();
      messages.push({
        ...contactData,
        id: `local_${Date.now()}`,
        created_at: new Date().toISOString()
      });
      localStorage.setItem('contact_messages', JSON.stringify(messages));
      return true;
    } catch (error) {
      logger.error('Error saving to localStorage', 'EmailService', {}, error as Error);
      return false;
    }
  }

  getLocalMessages(): any[] {
    try {
      const stored = localStorage.getItem('contact_messages');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      logger.error('Error reading from localStorage', 'EmailService', {}, error as Error);
      return [];
    }
  }

  clearLocalMessages(): void {
    try {
      localStorage.removeItem('contact_messages');
    } catch (error) {
      logger.error('Error clearing localStorage', 'EmailService', {}, error as Error);
    }
  }
}

export const emailService = new EmailService()
