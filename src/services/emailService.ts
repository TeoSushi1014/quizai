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
  private readonly EMAILJS_TEMPLATE_ID = 'template_yk32a0i'; // Template ID CHÍNH XÁC từ EmailJS test
  private readonly EMAILJS_AUTO_REPLY_TEMPLATE_ID = 'template_zxpohea'; // Auto-Reply template cho user
  private readonly EMAILJS_PUBLIC_KEY = '3PkkqTaNztt7DEKdi'; // Public Key từ EmailJS Account → General
  
  // Template parameters method để match với EmailJS template format  
  private getSimpleTemplateParams(contactData: ContactMessage, messageId: string) {
    return {
      // Template variables phải match với EmailJS template
      name: contactData.userName,        // {{name}} trong template
      email: contactData.userEmail,      // {{email}} nếu có
      message: contactData.message,      // {{message}} trong template
      title: `New Contact Message from ${contactData.userName}`,
      // Additional info cho admin
      message_id: messageId,
      timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      // User info for better email display
      from_name: contactData.userName,
      from_email: contactData.userEmail,
      reply_to: contactData.userEmail
    };
  }

  // Auto-reply template parameters cho user
  private getAutoReplyTemplateParams(contactData: ContactMessage, messageId: string) {
    return {
      // Template variables cho auto-reply email gửi cho user
      to_name: contactData.userName,     // {{to_name}} - tên người nhận (user)
      to_email: contactData.userEmail,   // {{to_email}} - email người nhận
      user_name: contactData.userName,   // {{user_name}} - backup
      user_email: contactData.userEmail, // {{user_email}} - backup
      // Thêm fields có thể cần cho EmailJS auto-reply
      to: contactData.userEmail,         // {{to}} - recipient email
      name: contactData.userName,        // {{name}} - recipient name
      email: contactData.userEmail,      // {{email}} - recipient email (backup)
      message_id: messageId,
      timestamp: new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
      // Admin info
      admin_email: this.ADMIN_EMAIL,
      app_name: 'QuizAI',
      app_url: window.location.origin
    };
  }
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
      let emailSent = false;
      try {
        await this.sendEmailNotificationToAdmin(contactData, data.id);
        logger.info('Admin email notification sent successfully', 'EmailService');
        emailSent = true;
      } catch (emailError) {
        logger.error('Failed to send admin email notification', 'EmailService', {
          willUseFallback: true,
          messageStillSaved: true
        }, emailError as Error);
        emailSent = false;
      }

      // Gửi auto-reply email cho user
      let autoReplySent = false;
      try {
        await this.sendAutoReplyToUser(contactData, data.id);
        logger.info('Auto-reply email sent successfully to user', 'EmailService');
        autoReplySent = true;
      } catch (autoReplyError) {
        logger.error('Failed to send auto-reply email to user', 'EmailService', {
          willContinueAnyway: true,
          messageStillSaved: true,
          adminEmailStatus: emailSent ? 'sent' : 'failed'
        }, autoReplyError as Error);
        autoReplySent = false;
        // KHÔNG throw error ở đây để không block success notification
      }
      
      // Log kết quả chi tiết
      if (emailSent && autoReplySent) {
        logger.info('✅ Contact message sent completely (database + admin email + auto-reply)', 'EmailService');
      } else if (emailSent) {
        logger.info('✅ Contact message sent (database + admin email, auto-reply failed)', 'EmailService');
      } else if (autoReplySent) {
        logger.info('✅ Contact message sent (database + auto-reply, admin email failed)', 'EmailService');
      } else {
        logger.info('✅ Contact message saved to database but both emails failed', 'EmailService');
      }
      
      // LUÔN return true nếu database thành công - user sẽ thấy notification
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
      // Use simple template parameters that are commonly supported
      const templateParams = this.getSimpleTemplateParams(contactData, messageId);

      // Log template params for debugging
      logger.info('Sending email with SIMPLE template params', 'EmailService', {
        templateParams: { 
          ...templateParams, 
          message: templateParams.message.substring(0, 50) + '...' 
        },
        templateId: this.EMAILJS_TEMPLATE_ID,
        serviceId: this.EMAILJS_SERVICE_ID
      });

      console.log('🚀 EmailJS sending with params:', {
        serviceId: this.EMAILJS_SERVICE_ID,
        templateId: this.EMAILJS_TEMPLATE_ID,
        params: { ...templateParams, message: templateParams.message.substring(0, 30) + '...' }
      });

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

      console.log('✅ EmailJS success response:', {
        status: response.status,
        text: response.text
      });

      if (response.status !== 200) {
        throw new Error(`EmailJS failed with status: ${response.status}, text: ${response.text}`);
      }

    } catch (error) {
      // Log detailed error information
      const err = error as any;
      logger.error('Error in sendEmailNotificationToAdmin', 'EmailService', {
        errorMessage: err.message,
        errorStatus: err.status,
        errorText: err.text,
        errorResponse: err.response
      }, error as Error);
      
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

  private async sendAutoReplyToUser(contactData: ContactMessage, messageId: string): Promise<void> {
    try {
      // Prepare auto-reply template parameters
      const templateParams = this.getAutoReplyTemplateParams(contactData, messageId);

      console.log('🤖 Sending auto-reply to user:', {
        to: contactData.userEmail,
        userName: contactData.userName,
        templateId: this.EMAILJS_AUTO_REPLY_TEMPLATE_ID,
        params: { 
          to: templateParams.to,
          to_email: templateParams.to_email,
          name: templateParams.name,
          message_id: templateParams.message_id 
        }
      });

      // Validate recipient email trước khi gửi
      if (!contactData.userEmail || !contactData.userEmail.includes('@')) {
        throw new Error(`Invalid recipient email: ${contactData.userEmail}`);
      }

      // Send auto-reply email using EmailJS
      const response = await emailjs.send(
        this.EMAILJS_SERVICE_ID,
        this.EMAILJS_AUTO_REPLY_TEMPLATE_ID,
        templateParams,
        this.EMAILJS_PUBLIC_KEY
      );

      console.log('✅ Auto-reply sent successfully:', {
        status: response.status,
        text: response.text,
        recipient: contactData.userEmail
      });

      if (response.status !== 200) {
        throw new Error(`Auto-reply EmailJS failed with status: ${response.status}, text: ${response.text}`);
      }

    } catch (error) {
      const err = error as any;
      logger.error('Error in sendAutoReplyToUser', 'EmailService', {
        errorMessage: err.message,
        errorStatus: err.status,
        errorText: err.text,
        recipient: contactData.userEmail,
        templateId: this.EMAILJS_AUTO_REPLY_TEMPLATE_ID
      }, error as Error);
      
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
