import{l as r,a0 as c}from"./index-jWnzXYss.js";class z{async saveQuizResult(e){try{r.info("Saving quiz result to database","QuizResultsService",{quizId:e.quizId,score:e.score,totalQuestions:e.totalQuestions,userId:e.userId});const{data:i,error:u}=await c.from("quiz_results").insert([{user_id:e.userId||null,quiz_id:e.quizId,score:e.score,total_questions:e.totalQuestions,answers:e.answers,time_taken:e.timeTaken||null,created_at:new Date().toISOString()}]).select().single();return u?(r.error("Failed to save quiz result","QuizResultsService",{error:u.message,code:u.code}),null):(r.info("Quiz result saved successfully","QuizResultsService",{resultId:i.id,quizId:e.quizId}),i.id)}catch(i){return r.error("Error saving quiz result","QuizResultsService",{},i),null}}async getQuizHistory(e){try{r.info("Fetching quiz history","QuizResultsService",{quizId:e.quizId,userId:e.userId,limit:e.limit});let i=c.from("quiz_results").select(`
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
        `).eq("quiz_id",e.quizId).order("created_at",{ascending:!1});e.userId&&(i=i.eq("user_id",e.userId)),e.limit&&(i=i.limit(e.limit)),e.offset&&(i=i.range(e.offset,e.offset+(e.limit||10)-1));const{data:u,error:a}=await i;if(a)return r.error("Failed to fetch quiz history","QuizResultsService",{error:a.message,code:a.code}),[];const s=u.map(t=>{var o,l;return{id:t.id,user_id:t.user_id,quiz_id:t.quiz_id,score:t.score,total_questions:t.total_questions,answers:t.answers,time_taken:t.time_taken,created_at:t.created_at,user_name:((o=t.users)==null?void 0:o.name)||"Anonymous User",user_email:((l=t.users)==null?void 0:l.email)||null}});return r.info("Quiz history fetched successfully","QuizResultsService",{quizId:e.quizId,resultCount:s.length}),s}catch(i){return r.error("Error fetching quiz history","QuizResultsService",{},i),[]}}async getUserQuizHistory(e,i=20){try{r.info("Fetching user quiz history","QuizResultsService",{userId:e,limit:i});const{data:u,error:a}=await c.from("quiz_results").select(`
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
        `).eq("user_id",e).order("created_at",{ascending:!1}).limit(i);if(a)return r.error("Failed to fetch user quiz history","QuizResultsService",{error:a.message,code:a.code}),[];const s=u.map(t=>{var o;return{id:t.id,user_id:t.user_id,quiz_id:t.quiz_id,score:t.score,total_questions:t.total_questions,answers:t.answers,time_taken:t.time_taken,created_at:t.created_at,quiz_title:((o=t.quizzes)==null?void 0:o.title)||"Unknown Quiz"}});return r.info("User quiz history fetched successfully","QuizResultsService",{userId:e,resultCount:s.length}),s}catch(u){return r.error("Error fetching user quiz history","QuizResultsService",{},u),[]}}async getQuizStats(e){try{r.info("Fetching quiz statistics","QuizResultsService",{quizId:e});const{data:i,error:u}=await c.from("quiz_results").select("score, time_taken, user_id").eq("quiz_id",e);if(u)return r.error("Failed to fetch quiz statistics","QuizResultsService",{error:u.message,code:u.code}),{totalAttempts:0,averageScore:0,bestScore:0,averageTime:0,uniqueUsers:0};const a=i||[],s=a.map(n=>n.score),t=a.filter(n=>n.time_taken!==null).map(n=>n.time_taken),o=new Set(a.filter(n=>n.user_id).map(n=>n.user_id)),l={totalAttempts:a.length,averageScore:s.length>0?Math.round(s.reduce((n,d)=>n+d,0)/s.length):0,bestScore:s.length>0?Math.max(...s):0,averageTime:t.length>0?Math.round(t.reduce((n,d)=>n+d,0)/t.length):0,uniqueUsers:o.size};return r.info("Quiz statistics calculated","QuizResultsService",{quizId:e,...l}),l}catch(i){return r.error("Error calculating quiz statistics","QuizResultsService",{},i),{totalAttempts:0,averageScore:0,bestScore:0,averageTime:0,uniqueUsers:0}}}async getQuizResult(e){var i,u,a;try{r.info("Fetching quiz result details","QuizResultsService",{resultId:e});const{data:s,error:t}=await c.from("quiz_results").select(`
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
        `).eq("id",e).single();if(t)return r.error("Failed to fetch quiz result details","QuizResultsService",{error:t.message,code:t.code}),null;const o={id:s.id,user_id:s.user_id,quiz_id:s.quiz_id,score:s.score,total_questions:s.total_questions,answers:s.answers,time_taken:s.time_taken,created_at:s.created_at,user_name:((i=s.users)==null?void 0:i.name)||"Anonymous User",user_email:((u=s.users)==null?void 0:u.email)||null,quiz_title:((a=s.quizzes)==null?void 0:a.title)||"Unknown Quiz"};return r.info("Quiz result details fetched successfully","QuizResultsService",{resultId:e}),o}catch(s){return r.error("Error fetching quiz result details","QuizResultsService",{},s),null}}}const f=new z;export{f as q};
