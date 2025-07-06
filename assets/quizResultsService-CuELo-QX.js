import{l as r,a3 as c}from"./index-Po4cPvhg.js";class z{async saveQuizResult(e){try{r.info("Saving quiz result to database","QuizResultsService",{quizId:e.quizId,score:e.score,totalQuestions:e.totalQuestions,userId:e.userId});const{data:s,error:u}=await c.from("quiz_results").insert([{user_id:e.userId||null,quiz_id:e.quizId,score:e.score,total_questions:e.totalQuestions,answers:e.answers,time_taken:e.timeTaken||null,created_at:new Date().toISOString()}]).select().single();return u?(r.error("Failed to save quiz result","QuizResultsService",{error:u.message,code:u.code}),null):(r.info("Quiz result saved successfully","QuizResultsService",{resultId:s.id,quizId:e.quizId}),s.id)}catch(s){return r.error("Error saving quiz result","QuizResultsService",{},s),null}}async getQuizHistory(e){try{r.info("Fetching quiz history","QuizResultsService",{quizId:e.quizId,userId:e.userId,limit:e.limit});let s=c.from("quiz_results").select(`
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
          )
        `).eq("quiz_id",e.quizId).order("created_at",{ascending:!1});e.userId?(r.info("Filtering quiz history by userId","QuizResultsService",{userId:e.userId}),s=s.eq("user_id",e.userId)):r.info("Getting all quiz history (no user filter)","QuizResultsService"),e.limit&&(s=s.limit(e.limit)),e.offset&&(s=s.range(e.offset,e.offset+(e.limit||10)-1));const{data:u,error:n}=await s;if(n)return r.error("Failed to fetch quiz history","QuizResultsService",{error:n.message,code:n.code}),[];const i=u.map(t=>{var o,l;return{id:t.id,user_id:t.user_id,quiz_id:t.quiz_id,score:t.score,total_questions:t.total_questions,answers:t.answers,time_taken:t.time_taken,created_at:t.created_at,user_name:((o=t.users)==null?void 0:o.name)||"Anonymous User",user_email:((l=t.users)==null?void 0:l.email)||null}});return r.info("Quiz history fetched successfully","QuizResultsService",{quizId:e.quizId,resultCount:i.length}),i}catch(s){return r.error("Error fetching quiz history","QuizResultsService",{},s),[]}}async getUserQuizHistory(e,s=20){try{r.info("Fetching user quiz history","QuizResultsService",{userId:e,limit:s});const{data:u,error:n}=await c.from("quiz_results").select(`
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
        `).eq("user_id",e).order("created_at",{ascending:!1}).limit(s);if(n)return r.error("Failed to fetch user quiz history","QuizResultsService",{error:n.message,code:n.code}),[];const i=u.map(t=>{var o;return{id:t.id,user_id:t.user_id,quiz_id:t.quiz_id,score:t.score,total_questions:t.total_questions,answers:t.answers,time_taken:t.time_taken,created_at:t.created_at,quiz_title:((o=t.quizzes)==null?void 0:o.title)||"Unknown Quiz"}});return r.info("User quiz history fetched successfully","QuizResultsService",{userId:e,resultCount:i.length}),i}catch(u){return r.error("Error fetching user quiz history","QuizResultsService",{},u),[]}}async getQuizStats(e){try{r.info("Fetching quiz statistics","QuizResultsService",{quizId:e});const{data:s,error:u}=await c.from("quiz_results").select("score, time_taken, user_id").eq("quiz_id",e);if(u)return r.error("Failed to fetch quiz statistics","QuizResultsService",{error:u.message,code:u.code}),{totalAttempts:0,averageScore:0,bestScore:0,averageTime:0,uniqueUsers:0};const n=s||[],i=n.map(a=>a.score),t=n.filter(a=>a.time_taken!==null).map(a=>a.time_taken),o=new Set(n.filter(a=>a.user_id).map(a=>a.user_id)),l={totalAttempts:n.length,averageScore:i.length>0?Math.round(i.reduce((a,d)=>a+d,0)/i.length):0,bestScore:i.length>0?Math.max(...i):0,averageTime:t.length>0?Math.round(t.reduce((a,d)=>a+d,0)/t.length):0,uniqueUsers:o.size};return r.info("Quiz statistics calculated","QuizResultsService",{quizId:e,...l}),l}catch(s){return r.error("Error calculating quiz statistics","QuizResultsService",{},s),{totalAttempts:0,averageScore:0,bestScore:0,averageTime:0,uniqueUsers:0}}}async getQuizResult(e){var s,u,n;try{r.info("Fetching quiz result details","QuizResultsService",{resultId:e});const{data:i,error:t}=await c.from("quiz_results").select(`
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
        `).eq("id",e).single();if(t)return r.error("Failed to fetch quiz result details","QuizResultsService",{error:t.message,code:t.code}),null;const o={id:i.id,user_id:i.user_id,quiz_id:i.quiz_id,score:i.score,total_questions:i.total_questions,answers:i.answers,time_taken:i.time_taken,created_at:i.created_at,user_name:((s=i.users)==null?void 0:s.name)||"Anonymous User",user_email:((u=i.users)==null?void 0:u.email)||null,quiz_title:((n=i.quizzes)==null?void 0:n.title)||"Unknown Quiz"};return r.info("Quiz result details fetched successfully","QuizResultsService",{resultId:e}),o}catch(i){return r.error("Error fetching quiz result details","QuizResultsService",{},i),null}}}const f=new z;export{f as q};
