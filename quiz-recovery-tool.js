// Quiz Recovery Tool for QuizAI
// Usage: Copy and paste this into the browser console when debugging sharing issues

(async function createQuizRecoveryTool() {
  // Add recovery tool to window
  window.QuizRecoveryTool = {
    // Function to fix orphaned quiz sharing entries
    async fixOrphanedQuiz(shareId) {
      console.log(`🔧 Starting recovery for share ID: ${shareId}`);
      
      try {
        // Get the debug tools first
        const { supabaseService } = await import('./src/services/supabaseService.ts');
        
        // Try to get the shared quiz info
        const { data: sharedQuiz, error: shareError } = await supabaseService.supabase
          .from('shared_quizzes')
          .select('*')
          .eq('id', shareId)
          .single();
          
        if (shareError) {
          console.error('❌ Could not find shared quiz:', shareError);
          return false;
        }
        
        console.log('📋 Found shared quiz:', sharedQuiz);
        
        // Check if the quiz exists in the main quizzes table
        const { data: quiz, error: quizError } = await supabaseService.supabase
          .from('quizzes')
          .select('*')
          .eq('id', sharedQuiz.quiz_id)
          .single();
          
        if (quiz) {
          console.log('✅ Quiz data already exists in main table');
          return true;
        }
        
        console.log('🔍 Quiz not found in main table, attempting recovery...');
        
        // Try to find the quiz by title and creator
        const { data: possibleQuizzes, error: searchError } = await supabaseService.supabase
          .from('quizzes')
          .select('*')
          .eq('created_by', sharedQuiz.created_by)
          .ilike('title', `%${sharedQuiz.title}%`);
          
        if (searchError) {
          console.error('❌ Search error:', searchError);
          return false;
        }
        
        if (possibleQuizzes && possibleQuizzes.length > 0) {
          console.log('🎯 Found possible matching quizzes:', possibleQuizzes);
          
          // Update the shared_quiz entry with the correct quiz_id
          const bestMatch = possibleQuizzes[0];
          const { error: updateError } = await supabaseService.supabase
            .from('shared_quizzes')
            .update({ quiz_id: bestMatch.id })
            .eq('id', shareId);
            
          if (updateError) {
            console.error('❌ Failed to update shared quiz:', updateError);
            return false;
          }
          
          console.log('✅ Successfully linked shared quiz to existing quiz data');
          return true;
        }
        
        console.log('❌ No matching quiz found for recovery');
        return false;
        
      } catch (error) {
        console.error('❌ Recovery tool error:', error);
        return false;
      }
    },
    
    // Function to clean up orphaned entries
    async cleanupOrphanedEntries() {
      console.log('🧹 Starting cleanup of orphaned shared quiz entries...');
      
      try {
        const { supabaseService } = await import('./src/services/supabaseService.ts');
        
        // Find all shared quizzes that don't have corresponding quiz data
        const { data: orphanedShares, error } = await supabaseService.supabase
          .from('shared_quizzes')
          .select(`
            *,
            quizzes (id)
          `)
          .is('quizzes.id', null);
          
        if (error) {
          console.error('❌ Error finding orphaned entries:', error);
          return;
        }
        
        console.log(`📊 Found ${orphanedShares?.length || 0} orphaned shared quiz entries`);
        
        if (orphanedShares && orphanedShares.length > 0) {
          console.log('🗑️ Orphaned entries:', orphanedShares);
          
          // Option to delete them
          const shouldDelete = confirm(`Delete ${orphanedShares.length} orphaned shared quiz entries?`);
          if (shouldDelete) {
            const orphanedIds = orphanedShares.map(share => share.id);
            const { error: deleteError } = await supabaseService.supabase
              .from('shared_quizzes')
              .delete()
              .in('id', orphanedIds);
              
            if (deleteError) {
              console.error('❌ Error deleting orphaned entries:', deleteError);
            } else {
              console.log('✅ Successfully deleted orphaned entries');
            }
          }
        }
        
      } catch (error) {
        console.error('❌ Cleanup error:', error);
      }
    },
    
    // Function to check sharing health
    async checkSharingHealth() {
      console.log('🔍 Checking quiz sharing health...');
      
      try {
        const { supabaseService } = await import('./src/services/supabaseService.ts');
        
        // Get total counts
        const { count: totalQuizzes } = await supabaseService.supabase
          .from('quizzes')
          .select('*', { count: 'exact', head: true });
          
        const { count: totalSharedQuizzes } = await supabaseService.supabase
          .from('shared_quizzes')
          .select('*', { count: 'exact', head: true });
          
        const { data: orphanedShares } = await supabaseService.supabase
          .from('shared_quizzes')
          .select(`
            id,
            quizzes (id)
          `)
          .is('quizzes.id', null);
          
        console.log('📊 Sharing Health Report:');
        console.log(`- Total Quizzes: ${totalQuizzes}`);
        console.log(`- Total Shared Quizzes: ${totalSharedQuizzes}`);
        console.log(`- Orphaned Shared Quizzes: ${orphanedShares?.length || 0}`);
        
        if (orphanedShares && orphanedShares.length > 0) {
          console.warn('⚠️ Found orphaned shared quiz entries. Use cleanupOrphanedEntries() to fix.');
        } else {
          console.log('✅ All shared quizzes have valid quiz data');
        }
        
      } catch (error) {
        console.error('❌ Health check error:', error);
      }
    }
  };
  
  console.log('🛠️ Quiz Recovery Tool loaded!');
  console.log('Available commands:');
  console.log('- QuizRecoveryTool.fixOrphanedQuiz(shareId) - Fix a specific orphaned quiz');
  console.log('- QuizRecoveryTool.cleanupOrphanedEntries() - Clean up all orphaned entries');
  console.log('- QuizRecoveryTool.checkSharingHealth() - Check overall sharing health');
  console.log('');
  console.log('Example: QuizRecoveryTool.fixOrphanedQuiz("0551e5e-10f4-460f-b8e4-4307d9f925b0")');
})();
