import{a3 as l,l as n}from"./index-DeIFN2og.js";class c{async saveQuizResult(r){try{const{data:{session:t}}=await l.auth.getSession();if(!(t!=null&&t.user))return n.warn("User not authenticated, cannot save quiz result","QuizResultsService",{quizId:r.quizId}),null;const a={user_id:t.user.id,quiz_id:r.quizId,score:Number(r.score),total_questions:Number(r.totalQuestions),answers:r.answers||[],time_taken:typeof r.timeTaken=="number"?Math.round(r.timeTaken):null,created_at:new Date().toISOString()},{data:i,error:e}=await l.from("quiz_results").insert([a]).select("id").single();return e?(n.error("Failed to save quiz result","QuizResultsService",{error:e.message,code:e.code,details:e.details,hint:e.hint}),null):i.id}catch(t){return n.error("Error saving quiz result","QuizResultsService",{quizId:r.quizId,error:t.message},t),null}}async getQuizHistory(r){try{let t=l.from("quiz_results").select(`
          id,
          user_id,
          quiz_id,
          score,
          total_questions,
          answers,
          time_taken,
          created_at,
          users!user_id (
            name,
            email,
            image_url
          ),
          quizzes!quiz_id (
            title
          )
        `).eq("quiz_id",r.quizId).order("created_at",{ascending:!1});r.userId&&(t=t.eq("user_id",r.userId)),r.limit&&(t=t.limit(r.limit)),r.offset&&(t=t.range(r.offset,r.offset+(r.limit||10)-1));const{data:a,error:i}=await t;return i?(n.error("Failed to fetch quiz history","QuizResultsService",{error:i.message,code:i.code,details:i.details,hint:i.hint}),[]):(a||[]).map(e=>{var s,u,o,_;return{id:e.id,user_id:e.user_id,quiz_id:e.quiz_id,score:e.score,total_questions:e.total_questions,answers:e.answers||[],time_taken:e.time_taken,created_at:e.created_at,user_name:((s=e.users)==null?void 0:s.name)||"Anonymous",user_email:((u=e.users)==null?void 0:u.email)||null,user_image_url:((o=e.users)==null?void 0:o.image_url)||null,quiz_title:((_=e.quizzes)==null?void 0:_.title)||null}})}catch(t){return n.error("Error fetching quiz history","QuizResultsService",{quizId:r.quizId,error:t.message},t),[]}}async getUserQuizHistory(r,t=20){try{const{data:a,error:i}=await l.from("quiz_results").select(`
          id,
          user_id,
          quiz_id,
          score,
          total_questions,
          answers,
          time_taken,
          created_at,
          quizzes:quiz_id (
            title,
            user_id
          )
        `).eq("user_id",r).order("created_at",{ascending:!1}).limit(t);return i?(n.error("Failed to fetch user quiz history","QuizResultsService",{error:i.message,code:i.code}),[]):a.map(e=>{var s;return{id:e.id,user_id:e.user_id,quiz_id:e.quiz_id,score:e.score,total_questions:e.total_questions,answers:e.answers,time_taken:e.time_taken,created_at:e.created_at,quiz_title:((s=e.quizzes)==null?void 0:s.title)||"Unknown Quiz"}})}catch(a){return n.error("Error fetching user quiz history","QuizResultsService",{},a),[]}}async getQuizStats(r){try{const{data:t,error:a}=await l.from("quiz_results").select("*").eq("quiz_id",r);if(a)return n.error("Failed to fetch quiz stats","QuizResultsService",{error:a.message,code:a.code}),{totalAttempts:0,averageScore:0,bestScore:0,averageTime:0,uniqueUsers:0};const i=t||[],e=i.map(u=>u.time_taken).filter(u=>typeof u=="number"&&!isNaN(u)),s=new Set(i.map(u=>u.user_id));return{totalAttempts:i.length,averageScore:i.length?i.reduce((u,o)=>u+o.score,0)/i.length:0,bestScore:i.length?Math.max(...i.map(u=>u.score)):0,averageTime:e.length?e.reduce((u,o)=>u+o,0)/e.length:0,uniqueUsers:s.size}}catch(t){return n.error("Error fetching quiz stats","QuizResultsService",{quizId:r,error:t.message},t),{totalAttempts:0,averageScore:0,bestScore:0,averageTime:0,uniqueUsers:0}}}async getQuizResult(r){var t,a,i,e;try{const{data:s,error:u}=await l.from("quiz_results").select(`
          id,
          user_id,
          quiz_id,
          score,
          total_questions,
          answers,
          time_taken,
          created_at,
          users!inner(
            name,
            email,
            image_url
          ),
          quizzes:quiz_id (
            title
          )
        `).eq("id",r).single();return u?(n.error("Failed to fetch quiz result","QuizResultsService",{error:u.message,code:u.code}),null):{id:s.id,user_id:s.user_id,quiz_id:s.quiz_id,score:s.score,total_questions:s.total_questions,answers:s.answers,time_taken:s.time_taken,created_at:s.created_at,user_name:((t=s.users)==null?void 0:t.name)||"Anonymous User",user_email:((a=s.users)==null?void 0:a.email)||null,user_image_url:((i=s.users)==null?void 0:i.image_url)||null,quiz_title:((e=s.quizzes)==null?void 0:e.title)||"Unknown Quiz"}}catch(s){return n.error("Error fetching quiz result","QuizResultsService",{resultId:r,error:s.message},s),null}}}const q=new c;export{q};
