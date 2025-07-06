import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabaseClient';
import { logger } from '../../services/logService';
import { Card } from '../ui';

interface ContactMessage {
  id: string;
  user_email: string;
  user_name: string;
  message: string;
  user_id?: string;
  created_at: string;
  status: string;
  admin_notes?: string;
}

export const ContactMessagesAdmin: React.FC = () => {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMessages();
  }, []);

  const loadMessages = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setMessages(data || []);
      logger.info('Contact messages loaded', 'ContactMessagesAdmin', { count: data?.length });
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      logger.error('Failed to load contact messages', 'ContactMessagesAdmin', {}, err as Error);
    } finally {
      setLoading(false);
    }
  };

  const updateMessageStatus = async (messageId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('contact_messages')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', messageId);

      if (error) {
        throw error;
      }

      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, status } : msg
        )
      );

      logger.info('Message status updated', 'ContactMessagesAdmin', { messageId, status });
    } catch (err) {
      logger.error('Failed to update message status', 'ContactMessagesAdmin', { messageId, status }, err as Error);
    }
  };

  if (loading) {
    return <div className="p-4">Loading contact messages...</div>;
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="text-red-600">Error loading messages: {error}</div>
        <button 
          onClick={loadMessages}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-2xl font-bold mb-4">Contact Messages ({messages.length})</h2>
      
      {messages.length === 0 ? (
        <div className="text-gray-500">No contact messages found.</div>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <Card key={message.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold">{message.user_name}</h3>
                  <p className="text-sm text-gray-600">{message.user_email}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span 
                    className={`px-2 py-1 text-xs rounded ${
                      message.status === 'new' ? 'bg-blue-100 text-blue-800' :
                      message.status === 'read' ? 'bg-yellow-100 text-yellow-800' :
                      message.status === 'replied' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {message.status}
                  </span>
                  <select
                    value={message.status}
                    onChange={(e) => updateMessageStatus(message.id, e.target.value)}
                    className="text-xs border rounded px-1 py-0.5"
                  >
                    <option value="new">New</option>
                    <option value="read">Read</option>
                    <option value="replied">Replied</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              
              <div className="bg-gray-50 p-3 rounded mb-2">
                <p className="whitespace-pre-wrap">{message.message}</p>
              </div>
              
              {message.user_id && (
                <p className="text-xs text-gray-500">User ID: {message.user_id}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ContactMessagesAdmin;
