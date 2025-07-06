import{a3 as l,l as s}from"./index-vw258tHq.js";class z{async saveQuizResult(e){try{const{data:{session:i}}=await l.auth.getSession();if(!(i!=null&&i.user))return s.warn("User not authenticated, cannot save quiz result","QuizResultsService",{quizId:e.quizId}),null;s.info("Saving quiz result to database","QuizResultsService",{quizId:e.quizId,score:e.score,totalQuestions:e.totalQuestions,userId:e.userId,sessionUserId:i.user.id});const r={user_id:i.user.id,quiz_id:e.quizId,score:Number(e.score),total_questions:Number(e.totalQuestions),answers:e.answers||[],time_taken:e.timeTaken?Number(e.timeTaken):null,created_at:new Date().toISOString()},{data:a,error:t}=await l.from("quiz_results").insert([r]).select("id").single();return t?(s.error("Failed to save quiz result","QuizResultsService",{error:t.message,code:t.code,details:t.details,hint:t.hint,insertData:{...r,answers:`${r.answers.length} answers`}}),null):(s.info("Quiz result saved successfully","QuizResultsService",{resultId:a.id,quizId:e.quizId}),a.id)}catch(i){return s.error("Error saving quiz result","QuizResultsService",{quizId:e.quizId,error:i.message},i),null}}async getQuizHistory(e){try{s.info("Fetching quiz history","QuizResultsService",{quizId:e.quizId,userId:e.userId,limit:e.limit});const{data:{session:i}}=await l.auth.getSession();if(!(i!=null&&i.user))return s.warn("User not authenticated, returning empty quiz history","QuizResultsService"),[];let r=l.from("quiz_results").select(`
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
            email
          )
        `).eq("quiz_id",e.quizId).order("created_at",{ascending:!1});e.userId?(s.info("Filtering quiz history by userId","QuizResultsService",{userId:e.userId}),r=r.eq("user_id",e.userId)):s.info("Getting all quiz history (no user filter)","QuizResultsService"),e.limit&&(r=r.limit(e.limit)),e.offset&&(r=r.range(e.offset,e.offset+(e.limit||10)-1));const{data:a,error:t}=await r;if(t)return s.error("Failed to fetch quiz history","QuizResultsService",{error:t.message,code:t.code,details:t.details,hint:t.hint}),[];const u=(a||[]).map(n=>{var c,o;return{id:n.id,user_id:n.user_id,quiz_id:n.quiz_id,score:n.score,total_questions:n.total_questions,answers:n.answers||[],time_taken:n.time_taken,created_at:n.created_at,user_name:((c=n.users)==null?void 0:c.name)||"Anonymous User",user_email:((o=n.users)==null?void 0:o.email)||null}});return s.info("Quiz history fetched successfully","QuizResultsService",{quizId:e.quizId,resultCount:u.length}),u}catch(i){return s.error("Error fetching quiz history","QuizResultsService",{quizId:e.quizId,error:i.message},i),[]}}async getUserQuizHistory(e,i=20){try{s.info("Fetching user quiz history","QuizResultsService",{userId:e,limit:i});const{data:r,error:a}=await l.from("quiz_results").select(`
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
        `).eq("user_id",e).order("created_at",{ascending:!1}).limit(i);if(a)return s.error("Failed to fetch user quiz history","QuizResultsService",{error:a.message,code:a.code}),[];const t=r.map(u=>{var n;return{id:u.id,user_id:u.user_id,quiz_id:u.quiz_id,score:u.score,total_questions:u.total_questions,answers:u.answers,time_taken:u.time_taken,created_at:u.created_at,quiz_title:((n=u.quizzes)==null?void 0:n.title)||"Unknown Quiz"}});return s.info("User quiz history fetched successfully","QuizResultsService",{userId:e,resultCount:t.length}),t}catch(r){return s.error("Error fetching user quiz history","QuizResultsService",{},r),[]}}async getQuizStats(e){try{s.info("Fetching quiz statistics","QuizResultsService",{quizId:e});const{data:i,error:r}=await l.from("quiz_results").select("score, time_taken, user_id").eq("quiz_id",e);if(r)return s.error("Failed to fetch quiz statistics","QuizResultsService",{error:r.message,code:r.code}),{totalAttempts:0,averageScore:0,bestScore:0,averageTime:0,uniqueUsers:0};const a=i||[],t=a.map(o=>o.score),u=a.filter(o=>o.time_taken!==null).map(o=>o.time_taken),n=new Set(a.filter(o=>o.user_id).map(o=>o.user_id)),c={totalAttempts:a.length,averageScore:t.length>0?Math.round(t.reduce((o,d)=>o+d,0)/t.length):0,bestScore:t.length>0?Math.max(...t):0,averageTime:u.length>0?Math.round(u.reduce((o,d)=>o+d,0)/u.length):0,uniqueUsers:n.size};return s.info("Quiz statistics calculated","QuizResultsService",{quizId:e,...c}),c}catch(i){return s.error("Error calculating quiz statistics","QuizResultsService",{},i),{totalAttempts:0,averageScore:0,bestScore:0,averageTime:0,uniqueUsers:0}}}async getQuizResult(e){var i,r,a;try{s.info("Fetching quiz result details","QuizResultsService",{resultId:e});const{data:t,error:u}=await l.from("quiz_results").select(`
          id,
          user_id,
          quiz_id,
          score,
          total_questions,
          answers,
          time_taken,
          created_at,
          users:user_id (
            name,
            email
          ),
          quizzes:quiz_id (
            title,
            questions
          )
        `).eq("id",e).single();if(u)return s.error("Failed to fetch quiz result details","QuizResultsService",{error:u.message,code:u.code}),null;const n={id:t.id,user_id:t.user_id,quiz_id:t.quiz_id,score:t.score,total_questions:t.total_questions,answers:t.answers,time_taken:t.time_taken,created_at:t.created_at,user_name:((i=t.users)==null?void 0:i.name)||"Anonymous User",user_email:((r=t.users)==null?void 0:r.email)||null,quiz_title:((a=t.quizzes)==null?void 0:a.title)||"Unknown Quiz"};return s.info("Quiz result details fetched successfully","QuizResultsService",{resultId:e}),n}catch(t){return s.error("Error fetching quiz result details","QuizResultsService",{},t),null}}}const f=new z;export{f as q};
