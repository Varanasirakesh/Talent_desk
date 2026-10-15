"""Server-rendered Talent Desk UI powered by HTMX and Alpine."""
from datetime import UTC, datetime
from decimal import Decimal
from io import StringIO
import csv, json, re
from urllib.parse import quote_plus
from uuid import uuid4
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.responses import JSONResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload
from app.database import get_session
from app.demo_candidates import DEMO_CANDIDATES
from app.models import Candidate, CandidateMatch, Job, JobKeyword, OnboardingTask, RecruiterSettings, ShortlistEntry
from app.ai import AIServiceError, generate_json

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")
ALIASES = {"Spark":["spark","pyspark"],"Node.js":["node.js","nodejs"],"Data modelling":["data modelling","data modeling","dimensional modelling","dimensional modeling"],"Data analytics":["data analytics","analytics","analytical"],"PowerBI":["power bi","powerbi"]}
SKILL_DICTIONARY = {"Python":["python"],"SQL":["sql"],"React":["react","reactjs","react.js"],"TypeScript":["typescript"],"JavaScript":["javascript"],"dbt":["dbt"],"Airflow":["airflow"],"Snowflake":["snowflake"],"AWS":["aws","amazon web services"],"Azure":["azure"],"Docker":["docker"],"Kubernetes":["kubernetes","k8s"],"Playwright":["playwright"],"Selenium":["selenium"],"API testing":["api testing","api tests","rest api testing"],"Figma":["figma"],"User research":["user research"],"Excel":["excel"],"Tableau":["tableau"],"Project management":["project management"],"Stakeholder management":["stakeholder management"]}
SKILL_DICTIONARY.update(ALIASES)
def number(value: str | None): return Decimal(value) if value and value.strip() else None
async def resume_content(upload: UploadFile | None, text: str) -> tuple[str, str]:
    if not upload or not upload.filename: return text.strip(), "upload"
    suffix = upload.filename.rsplit(".", 1)[-1].lower() if "." in upload.filename else ""
    if suffix not in {"txt", "md", "pdf", "docx"}: raise HTTPException(422, "Choose a TXT, MD, PDF, or DOCX resume")
    data = await upload.read()
    if not data: raise HTTPException(422, "The resume file is empty")
    if len(data) > 10 * 1024 * 1024: raise HTTPException(422, "Resume files must be under 10 MB")
    try:
        if suffix in {"txt", "md"}: extracted = data.decode("utf-8")
        elif suffix == "pdf":
            from pypdf import PdfReader
            from io import BytesIO
            reader = PdfReader(BytesIO(data))
            if len(reader.pages) > 20: raise HTTPException(422, "PDFs are limited to 20 pages")
            extracted = "\n".join(page.extract_text() or "" for page in reader.pages)
        else:
            from docx import Document
            from io import BytesIO
            extracted = "\n".join(p.text for p in Document(BytesIO(data)).paragraphs)
    except HTTPException: raise
    except Exception as error: raise HTTPException(422, f"Could not read {upload.filename}; use an accessible text-based file") from error
    extracted = extracted.replace("\x00", "").strip()
    if not extracted: raise HTTPException(422, "No readable text was found in the resume")
    return extracted[:100000], "upload"
def job_or_404(session, job_id):
    job=session.scalar(select(Job).where(Job.id==job_id).options(selectinload(Job.keywords)))
    if not job: raise HTTPException(404,"Requisition not found")
    return job
def scores(job, candidates, shortlisted):
    terms=[x.term for x in job.keywords if x.is_approved]; rows=[]
    jd_terms={token.casefold() for token in re.findall(r"[A-Za-z][A-Za-z+#.]{2,}",job.description) if token.casefold() not in {"the","and","for","with","that","this","from","will","are","you","our","job","role","years","have","their","your","into","using","work","team","skills","experience","required","preferred"}}
    for candidate in candidates:
        matched=[]; evidence={}
        for term in terms:
            alias=next((x for x in ALIASES.get(term,[term]) if re.search(rf"(?i)(?<![a-z0-9]){re.escape(x)}(?![a-z0-9])",candidate.resume_text)),None)
            if alias:
                matched.append(term); evidence[term]=next((line.strip() for line in candidate.resume_text.splitlines() if re.search(rf"(?i){re.escape(alias)}",line)),alias)[:240]
        missing=[x for x in terms if x not in matched]
        prompts=[f"Ask for a concrete example of {skill} work. Resume evidence: {evidence[skill]}" for skill in matched[:2]] + [f"Ask whether they have used {skill}; no supporting profile evidence was found." for skill in missing[:2]]
        keyword_score=round(len(matched)*100/len(terms)) if terms else 0
        profile_terms={token.casefold() for token in re.findall(r"[A-Za-z][A-Za-z+#.]{2,}",candidate.resume_text)}
        description_score=round(len(jd_terms & profile_terms)*100/len(jd_terms)) if jd_terms else 0
        overall_score=round(keyword_score*.7+description_score*.3) if terms else description_score
        rows.append({"candidate":candidate,"matched":matched,"missing":missing,"evidence":evidence,"score":overall_score,"keyword_score":keyword_score,"description_score":description_score,"shortlisted":candidate.id in shortlisted,"prompts":prompts})
    return sorted(rows,key=lambda x:x["score"],reverse=True)
def persist_match(session, job, candidate):
    result=scores(job,[candidate],set())[0]
    existing=session.scalar(select(CandidateMatch).where(CandidateMatch.job_id==job.id,CandidateMatch.candidate_id==candidate.id))
    values={"overall_score":result["score"],"keyword_score":result["keyword_score"],"evidence":{"matched":result["matched"],"missing":result["missing"],"lines":result["evidence"],"description_score":result["description_score"]}}
    if existing:
        for field,value in values.items(): setattr(existing,field,value)
    else: session.add(CandidateMatch(job_id=job.id,candidate_id=candidate.id,**values))
def recalculate_job_matches(session, job_id):
    job=job_or_404(session,job_id); session.flush();session.expire(job,["keywords"])
    for candidate in session.scalars(select(Candidate).where(Candidate.job_id==job_id)).all(): persist_match(session,job,candidate)
def search_query(job):
    terms=[f'"{job.title.strip()}"']+[f'"{item.term}"' for item in job.keywords if item.is_approved]
    return " AND ".join(term for term in terms if term != '""')

def recruiter_settings(session: Session) -> RecruiterSettings:
    """Support settings rows created before list defaults were added."""
    settings = session.get(RecruiterSettings, 1) or RecruiterSettings(id=1)
    settings.default_skills = settings.default_skills or []
    return settings

def ai_error_fragment(request: Request, field_id: str, name: str, value: str, message: str):
    return templates.TemplateResponse(request, "partials/ai_text_field.html", {
        "field_id": field_id, "name": name, "value": value, "message": message,
    }, status_code=502)

@router.post("/ui/ai/job-description", response_class=HTMLResponse)
async def ai_job_description(
    request: Request,
    title: str = Form(default=""),
    location: str = Form(default=""),
    min_experience_years: str = Form(default=""),
    max_experience_years: str = Form(default=""),
    description: str = Form(default=""),
):
    if len(title.strip()) < 2:
        return ai_error_fragment(request, "job-description-field", "description", description, "Enter a role title before generating a job description.")
    try:
        result = await generate_json(
            instruction=(
                "Write a complete, inclusive job description. Include a role summary, responsibilities, required "
                "qualifications, preferred qualifications, and an equal-opportunity note. Return JSON exactly as "
                '{"description":"..."}.'
            ),
            payload={"role_title": title.strip(), "location": location.strip() or None,
                     "min_experience_years": min_experience_years or None,
                     "max_experience_years": max_experience_years or None},
        )
        generated = str(result.get("description", "")).strip()
        if len(generated) < 50:
            raise ValueError("The generated description was too short. Please try again.")
        return templates.TemplateResponse(request, "partials/ai_text_field.html", {
            "field_id": "job-description-field", "name": "description", "value": generated, "message": "AI-generated. Review and edit before creating the job.",
        })
    except (AIServiceError, ValueError) as error:
        return ai_error_fragment(request, "job-description-field", "description", description, str(error))

@router.post("/ui/ai/keywords", response_class=HTMLResponse)
async def ai_keywords(
    request: Request,
    title: str = Form(default=""),
    description: str = Form(default=""),
    keywords: str = Form(default=""),
):
    if len(title.strip()) < 2 or len(description.strip()) < 20:
        return ai_error_fragment(request, "keywords-field", "keywords", keywords, "Enter a role title and job description before generating keywords.")
    try:
        result = await generate_json(
            instruction=(
                "Extract up to 20 specific candidate-search keywords: skills, tools, frameworks, certifications, "
                "domain terms, and seniority phrases. Exclude generic soft skills. Return JSON exactly as "
                '{"keywords":["term"]}.'
            ),
            payload={"job_title": title.strip(), "description": description.strip()},
        )
        terms: dict[str, str] = {term.casefold(): term for term in (item.strip()[:160] for item in keywords.split(",")) if term}
        values = result.get("keywords", [])
        if not isinstance(values, list):
            raise ValueError("The generated keywords were invalid. Please try again.")
        for item in values:
            term = str(item).strip()[:160]
            if term:
                terms.setdefault(term.casefold(), term)
        return templates.TemplateResponse(request, "partials/ai_text_field.html", {
            "field_id": "keywords-field", "name": "keywords", "value": ", ".join(terms.values()), "message": "AI suggestions added. Review the keywords before creating the job.", "input": True,
        })
    except (AIServiceError, ValueError) as error:
        return ai_error_fragment(request, "keywords-field", "keywords", keywords, str(error))

@router.get("/",response_class=HTMLResponse)
def home(request:Request,session:Session=Depends(get_session)):
    return templates.TemplateResponse(request,"index.html",{"settings":recruiter_settings(session)})
@router.get("/settings",response_class=HTMLResponse)
def settings_page(request:Request,session:Session=Depends(get_session)):
    settings=recruiter_settings(session)
    return templates.TemplateResponse(request,"settings.html",{"settings":settings})
@router.post("/settings",response_class=HTMLResponse)
def settings_save(request:Request,recruiter_name:str=Form(default=""),company:str=Form(default=""),default_role:str=Form(default=""),default_location:str=Form(default=""),default_skills:str=Form(default=""),min_experience_years:str=Form(default=""),max_notice_days:str=Form(default=""),max_salary_lpa:str=Form(default=""),linkedin_profile_url:str=Form(default=""),session:Session=Depends(get_session)):
    settings=session.get(RecruiterSettings,1) or RecruiterSettings(id=1)
    settings.recruiter_name=recruiter_name.strip();settings.company=company.strip();settings.default_role=default_role.strip();settings.default_location=default_location.strip();settings.default_skills=list(dict.fromkeys(x.strip() for x in default_skills.split(",") if x.strip()));settings.min_experience_years=number(min_experience_years);settings.max_notice_days=int(max_notice_days) if max_notice_days else None;settings.max_salary_lpa=number(max_salary_lpa);settings.linkedin_profile_url=linkedin_profile_url.strip()
    session.add(settings);session.commit();return templates.TemplateResponse(request,"settings.html",{"settings":settings,"saved":True})
@router.get("/settings/export.json")
def settings_export(session:Session=Depends(get_session)):
    settings=recruiter_settings(session)
    return JSONResponse({"recruiterName":settings.recruiter_name,"company":settings.company,"defaultRole":settings.default_role,"defaultLocation":settings.default_location,"defaultSkills":settings.default_skills,"minExperience":float(settings.min_experience_years) if settings.min_experience_years is not None else 0,"maxNoticeDays":settings.max_notice_days,"maxSalaryLpa":float(settings.max_salary_lpa) if settings.max_salary_lpa is not None else None,"linkedinProfileUrl":settings.linkedin_profile_url},headers={"Content-Disposition":"attachment; filename=hiring-settings.json"})
@router.post("/settings/import",response_class=HTMLResponse)
async def settings_import(request:Request,settings_file:UploadFile=File(),session:Session=Depends(get_session)):
    if not settings_file.filename or not settings_file.filename.lower().endswith(".json"): raise HTTPException(422,"Choose a JSON settings file")
    try:
        raw=await settings_file.read()
        if len(raw)>65536: raise ValueError("Settings file must be under 64 KB")
        value=json.loads(raw)
        if not isinstance(value,dict): raise ValueError("Settings must be a JSON object")
    except (UnicodeDecodeError,json.JSONDecodeError,ValueError) as error: raise HTTPException(422,str(error)) from error
    settings=session.get(RecruiterSettings,1) or RecruiterSettings(id=1)
    settings.recruiter_name=str(value.get("recruiterName","")).strip()[:255];settings.company=str(value.get("company","")).strip()[:255];settings.default_role=str(value.get("defaultRole","")).strip()[:255];settings.default_location=str(value.get("defaultLocation","")).strip()[:255]
    skills=value.get("defaultSkills",[]);settings.default_skills=list(dict.fromkeys(str(item).strip() for item in skills if str(item).strip()))[:50] if isinstance(skills,list) else []
    settings.min_experience_years=number(str(value["minExperience"])) if value.get("minExperience") is not None else None;settings.max_notice_days=int(value["maxNoticeDays"]) if value.get("maxNoticeDays") is not None else None;settings.max_salary_lpa=number(str(value["maxSalaryLpa"])) if value.get("maxSalaryLpa") is not None else None;settings.linkedin_profile_url=str(value.get("linkedinProfileUrl","")).strip()[:500]
    session.add(settings);session.commit();return templates.TemplateResponse(request,"settings.html",{"settings":settings,"saved":True,"imported":True})
@router.get("/ui/jobs",response_class=HTMLResponse)
def jobs(request:Request,session:Session=Depends(get_session)): return templates.TemplateResponse(request,"partials/jobs.html",{"jobs":session.scalars(select(Job).order_by(Job.created_at.desc())).all()})
@router.post("/ui/jobs",response_class=HTMLResponse)
def create_job(request:Request,title:str=Form(),description:str=Form(),location:str=Form(default=""),keywords:str=Form(default=""),min_experience_years:str=Form(default=""),max_experience_years:str=Form(default=""),salary_min_lpa:str=Form(default=""),salary_max_lpa:str=Form(default=""),max_notice_days:str=Form(default=""),session:Session=Depends(get_session)):
    year=datetime.now(UTC).year; count=session.scalar(select(func.count()).select_from(Job).where(Job.id.like(f"HR-{year}-%"))) or 0
    job=Job(id=f"HR-{year}-{count+1:03d}",title=title.strip(),description=description.strip(),location=location.strip() or None,min_experience_years=number(min_experience_years),max_experience_years=number(max_experience_years),salary_min_lpa=number(salary_min_lpa),salary_max_lpa=number(salary_max_lpa),max_notice_days=int(max_notice_days) if max_notice_days else None)
    job.keywords=[JobKeyword(term=x,source="human",is_approved=True) for x in dict.fromkeys(x.strip() for x in keywords.split(",") if x.strip())]; session.add(job); session.commit(); return jobs(request,session)
@router.delete("/ui/jobs/{job_id}",response_class=HTMLResponse)
def delete_job(request:Request,job_id:str,session:Session=Depends(get_session)):
    job=job_or_404(session,job_id)
    for task in session.scalars(select(OnboardingTask).where(OnboardingTask.job_id==job_id)).all(): session.delete(task)
    for entry in session.scalars(select(ShortlistEntry).where(ShortlistEntry.job_id==job_id)).all(): session.delete(entry)
    for match in session.scalars(select(CandidateMatch).where(CandidateMatch.job_id==job_id)).all(): session.delete(match)
    for candidate in session.scalars(select(Candidate).where(Candidate.job_id==job_id)).all(): session.delete(candidate)
    for keyword in session.scalars(select(JobKeyword).where(JobKeyword.job_id==job_id)).all(): session.delete(keyword)
    session.delete(job); session.commit()
    return jobs(request,session)
@router.get("/jobs/{job_id}",response_class=HTMLResponse)
def workspace(request:Request,job_id:str,session:Session=Depends(get_session)):
    job=job_or_404(session,job_id)
    query=search_query(job)
    return templates.TemplateResponse(request,"workspace.html",{"job":job,"candidates":session.scalars(select(Candidate).where(Candidate.job_id==job_id)).all(),"boolean_query":query,"linkedin_search_url":f"https://www.linkedin.com/search/results/people/?keywords={quote_plus(query)}"})
@router.post("/jobs/{job_id}/details",response_class=HTMLResponse)
def update_details(request:Request,job_id:str,title:str=Form(),description:str=Form(),location:str=Form(default=""),min_experience_years:str=Form(default=""),max_experience_years:str=Form(default=""),salary_min_lpa:str=Form(default=""),salary_max_lpa:str=Form(default=""),max_notice_days:str=Form(default=""),session:Session=Depends(get_session)):
    job=job_or_404(session,job_id)
    job.title=title.strip();job.description=description.strip();job.location=location.strip() or None;job.min_experience_years=number(min_experience_years);job.max_experience_years=number(max_experience_years);job.salary_min_lpa=number(salary_min_lpa);job.salary_max_lpa=number(salary_max_lpa);job.max_notice_days=int(max_notice_days) if max_notice_days else None
    if job.min_experience_years is not None and job.max_experience_years is not None and job.min_experience_years>job.max_experience_years: raise HTTPException(422,"Minimum experience cannot exceed maximum experience")
    if job.salary_min_lpa is not None and job.salary_max_lpa is not None and job.salary_min_lpa>job.salary_max_lpa: raise HTTPException(422,"Minimum budget cannot exceed maximum budget")
    session.commit()
    if request.headers.get("HX-Request"): return HTMLResponse("",headers={"HX-Redirect":f"/jobs/{job_id}"})
    return workspace(request,job_id,session)
@router.get("/jobs/{job_id}/keywords",response_class=HTMLResponse)
def keyword_list(request:Request,job_id:str,session:Session=Depends(get_session)): return templates.TemplateResponse(request,"partials/keywords.html",{"job":job_or_404(session,job_id)})
@router.post("/jobs/{job_id}/keywords",response_class=HTMLResponse)
def keyword_add(request:Request,job_id:str,term:str=Form(),session:Session=Depends(get_session)):
    job_or_404(session,job_id); term=term.strip()
    if term and not session.scalar(select(JobKeyword).where(JobKeyword.job_id==job_id,func.lower(JobKeyword.term)==term.lower())): session.add(JobKeyword(job_id=job_id,term=term,source="human",is_approved=True));recalculate_job_matches(session,job_id);session.commit()
    return keyword_list(request,job_id,session)
@router.post("/jobs/{job_id}/keywords/suggest",response_class=HTMLResponse)
def keyword_suggest(request:Request,job_id:str,session:Session=Depends(get_session)):
    job=job_or_404(session,job_id); text=f"{job.title}\n{job.description}"
    existing={x.term.casefold() for x in job.keywords}
    for skill,aliases in SKILL_DICTIONARY.items():
        if skill.casefold() not in existing and any(re.search(rf"(?i)(?<![a-z0-9]){re.escape(alias)}(?![a-z0-9])",text) for alias in aliases):
            session.add(JobKeyword(job_id=job_id,term=skill,source="ai",is_approved=True))
    recalculate_job_matches(session,job_id);session.commit();return keyword_list(request,job_id,session)
@router.delete("/jobs/{job_id}/keywords/{keyword_id}",response_class=HTMLResponse)
def keyword_delete(request:Request,job_id:str,keyword_id:int,session:Session=Depends(get_session)):
    item=session.scalar(select(JobKeyword).where(JobKeyword.id==keyword_id,JobKeyword.job_id==job_id))
    if item: session.delete(item);recalculate_job_matches(session,job_id);session.commit()
    return keyword_list(request,job_id,session)
@router.get("/jobs/{job_id}/candidates",response_class=HTMLResponse)
def candidate_list(request:Request,job_id:str,skill:str="",location:str="",min_experience:str="",max_notice_days:str="",max_salary_lpa:str="",source:str="all",sort:str="score",session:Session=Depends(get_session)):
    job=job_or_404(session,job_id); candidates=session.scalars(select(Candidate).where(Candidate.job_id==job_id)).all(); short=set(session.scalars(select(ShortlistEntry.candidate_id).where(ShortlistEntry.job_id==job_id)).all())
    rows=scores(job,candidates,short)
    if skill: rows=[row for row in rows if any(skill.casefold() in term.casefold() for term in row["matched"])]
    if location: rows=[row for row in rows if row["candidate"].location and location.casefold() in row["candidate"].location.casefold()]
    if min_experience: rows=[row for row in rows if row["candidate"].years_experience is not None and row["candidate"].years_experience >= Decimal(min_experience)]
    if max_notice_days: rows=[row for row in rows if row["candidate"].notice_days is not None and row["candidate"].notice_days <= int(max_notice_days)]
    if max_salary_lpa: rows=[row for row in rows if row["candidate"].salary_lpa is not None and row["candidate"].salary_lpa <= Decimal(max_salary_lpa)]
    if source in {"sample","upload"}: rows=[row for row in rows if row["candidate"].source == source]
    if sort == "name": rows.sort(key=lambda row:row["candidate"].name.casefold())
    if sort == "experience": rows.sort(key=lambda row:row["candidate"].years_experience or Decimal("-1"),reverse=True)
    return templates.TemplateResponse(request,"partials/candidates.html",{"rows":rows,"job":job})
@router.post("/jobs/{job_id}/candidates",response_class=HTMLResponse)
async def candidate_add(request:Request,job_id:str,name:str=Form(),resume_text:str=Form(default=""),resume_file:UploadFile|None=File(default=None),years_experience:str=Form(default=""),location:str=Form(default=""),notice_days:str=Form(default=""),salary_lpa:str=Form(default=""),session:Session=Depends(get_session)):
    job=job_or_404(session,job_id); content,source=await resume_content(resume_file,resume_text)
    if not name.strip(): raise HTTPException(422,"Candidate name is required")
    if not content: raise HTTPException(422,"Paste profile text or upload a resume")
    candidate=Candidate(id=str(uuid4()),job_id=job_id,name=name.strip(),source=source,resume_text=content,years_experience=number(years_experience),location=location.strip() or None,notice_days=int(notice_days) if notice_days else None,salary_lpa=number(salary_lpa));session.add(candidate);session.commit()
    persist_match(session,job,candidate);session.commit();return candidate_list(request,job_id,session=session)
@router.post("/jobs/{job_id}/candidates/import",response_class=HTMLResponse)
async def candidate_import(request:Request,job_id:str,resume_files:list[UploadFile]=File(),session:Session=Depends(get_session)):
    job=job_or_404(session,job_id); existing={candidate.resume_text for candidate in session.scalars(select(Candidate).where(Candidate.job_id==job_id)).all()}
    for upload in resume_files:
        content,source=await resume_content(upload,"")
        if not content or content in existing: continue
        name=(upload.filename.rsplit(".",1)[0] if upload.filename else "Candidate").replace("_"," ").replace("-"," ").strip()
        candidate=Candidate(id=str(uuid4()),job_id=job_id,name=name[:255] or "Candidate",source=source,resume_text=content)
        session.add(candidate);session.flush();persist_match(session,job,candidate);existing.add(content)
    session.commit();return candidate_list(request,job_id,session=session)
@router.post("/jobs/{job_id}/demo-candidates",response_class=HTMLResponse)
def add_demo_candidates(request:Request,job_id:str,session:Session=Depends(get_session)):
    job=job_or_404(session,job_id)
    for index,profile in enumerate(DEMO_CANDIDATES,1):
        candidate_id=f"demo-{job_id}-{index}"
        candidate=session.get(Candidate,candidate_id)
        if candidate: continue
        candidate=Candidate(id=candidate_id,job_id=job_id,name=profile["name"],source="sample",resume_text=profile["text"],years_experience=profile["years"],location=profile["location"],notice_days=profile["notice"],salary_lpa=profile["salary"])
        session.add(candidate);session.flush();persist_match(session,job,candidate)
    session.commit();return candidate_list(request,job_id,session=session)
@router.post("/jobs/{job_id}/candidates/{candidate_id}",response_class=HTMLResponse)
def candidate_update(request:Request,job_id:str,candidate_id:str,name:str=Form(),resume_text:str=Form(),years_experience:str=Form(default=""),location:str=Form(default=""),notice_days:str=Form(default=""),salary_lpa:str=Form(default=""),session:Session=Depends(get_session)):
    job=job_or_404(session,job_id); candidate=session.scalar(select(Candidate).where(Candidate.id==candidate_id,Candidate.job_id==job_id))
    if not candidate: raise HTTPException(404,"Candidate not found")
    if not name.strip() or not resume_text.strip(): raise HTTPException(422,"Candidate name and profile text are required")
    candidate.name=name.strip();candidate.resume_text=resume_text.strip();candidate.years_experience=number(years_experience);candidate.location=location.strip() or None;candidate.notice_days=int(notice_days) if notice_days else None;candidate.salary_lpa=number(salary_lpa)
    persist_match(session,job,candidate);session.commit();return candidate_list(request,job_id,session=session)
@router.delete("/jobs/{job_id}/candidates/{candidate_id}",response_class=HTMLResponse)
def candidate_delete(request:Request,job_id:str,candidate_id:str,session:Session=Depends(get_session)):
    candidate=session.scalar(select(Candidate).where(Candidate.id==candidate_id,Candidate.job_id==job_id))
    if candidate:
        match=session.scalar(select(CandidateMatch).where(CandidateMatch.job_id==job_id,CandidateMatch.candidate_id==candidate_id))
        shortlist_entry=session.scalar(select(ShortlistEntry).where(ShortlistEntry.job_id==job_id,ShortlistEntry.candidate_id==candidate_id))
        for task in session.scalars(select(OnboardingTask).where(OnboardingTask.job_id==job_id,OnboardingTask.candidate_id==candidate_id)).all(): task.candidate_id=None
        if match: session.delete(match)
        if shortlist_entry: session.delete(shortlist_entry)
        session.delete(candidate);session.commit()
    return candidate_list(request,job_id,session=session)
@router.post("/jobs/{job_id}/candidates/{candidate_id}/shortlist",response_class=HTMLResponse)
def shortlist(request:Request,job_id:str,candidate_id:str,session:Session=Depends(get_session)):
    if not session.scalar(select(ShortlistEntry).where(ShortlistEntry.job_id==job_id,ShortlistEntry.candidate_id==candidate_id)):session.add(ShortlistEntry(job_id=job_id,candidate_id=candidate_id));session.commit()
    return candidate_list(request,job_id,session=session)
@router.delete("/jobs/{job_id}/candidates/{candidate_id}/shortlist",response_class=HTMLResponse)
def unshortlist(request:Request,job_id:str,candidate_id:str,session:Session=Depends(get_session)):
    item=session.scalar(select(ShortlistEntry).where(ShortlistEntry.job_id==job_id,ShortlistEntry.candidate_id==candidate_id))
    if item:session.delete(item);session.commit()
    return candidate_list(request,job_id,session=session)
@router.get("/jobs/{job_id}/shortlist",response_class=HTMLResponse)
def shortlist_list(request:Request,job_id:str,session:Session=Depends(get_session)):
    job=job_or_404(session,job_id); ids=set(session.scalars(select(ShortlistEntry.candidate_id).where(ShortlistEntry.job_id==job_id)).all()); candidates=session.scalars(select(Candidate).where(Candidate.job_id==job_id)).all()
    return templates.TemplateResponse(request,"partials/shortlist.html",{"rows":[x for x in scores(job,candidates,ids) if x["shortlisted"]]})
@router.get("/jobs/{job_id}/export/candidates.csv")
def export_candidates(job_id:str,session:Session=Depends(get_session)):
    job=job_or_404(session,job_id); rows=scores(job,session.scalars(select(Candidate).where(Candidate.job_id==job_id)).all(),set());out=StringIO();writer=csv.writer(out);writer.writerow(["Job ID","Candidate","Match %","Matched skills","Missing skills","Experience","Location","Notice days","Salary LPA"])
    for row in rows:
        c=row["candidate"];writer.writerow([job_id,c.name,row["score"],"; ".join(row["matched"]),"; ".join(row["missing"]),c.years_experience,c.location,c.notice_days,c.salary_lpa])
    return StreamingResponse(iter([out.getvalue()]),media_type="text/csv",headers={"Content-Disposition":f'attachment; filename="{job_id}-candidates.csv"'})
@router.get("/jobs/{job_id}/export/shortlist.csv")
def export_shortlist(job_id:str,session:Session=Depends(get_session)):
    job=job_or_404(session,job_id); ids=set(session.scalars(select(ShortlistEntry.candidate_id).where(ShortlistEntry.job_id==job_id)).all()); rows=[row for row in scores(job,session.scalars(select(Candidate).where(Candidate.job_id==job_id)).all(),ids) if row["shortlisted"]]
    out=StringIO();writer=csv.writer(out);writer.writerow(["Job ID","Candidate","Overall match %","Matched skills","Missing skills"])
    for row in rows: writer.writerow([job_id,row["candidate"].name,row["score"],"; ".join(row["matched"]),"; ".join(row["missing"])])
    return StreamingResponse(iter([out.getvalue()]),media_type="text/csv",headers={"Content-Disposition":f'attachment; filename="{job_id}-shortlist.csv"'})
@router.get("/jobs/{job_id}/export.json")
def export_job(job_id:str,session:Session=Depends(get_session)):
    job=job_or_404(session,job_id)
    return JSONResponse({"id":job.id,"title":job.title,"location":job.location,"description":job.description,"min_experience_years":str(job.min_experience_years) if job.min_experience_years is not None else None,"max_experience_years":str(job.max_experience_years) if job.max_experience_years is not None else None,"salary_min_lpa":str(job.salary_min_lpa) if job.salary_min_lpa is not None else None,"salary_max_lpa":str(job.salary_max_lpa) if job.salary_max_lpa is not None else None,"max_notice_days":job.max_notice_days,"keywords":[{"term":x.term,"source":x.source,"is_approved":x.is_approved} for x in job.keywords]},headers={"Content-Disposition":f'attachment; filename="{job_id}.json"'})
@router.get("/jobs/{job_id}/export/onboarding.json")
def export_onboarding(job_id:str,session:Session=Depends(get_session)):
    job_or_404(session,job_id); tasks=session.scalars(select(OnboardingTask).where(OnboardingTask.job_id==job_id).order_by(OnboardingTask.id)).all()
    return JSONResponse({"jobId":job_id,"exportedAt":datetime.now(UTC).isoformat(),"tasks":[{"title":task.title,"owner":task.owner,"dueDate":task.due_date,"status":task.status,"candidateId":task.candidate_id} for task in tasks]},headers={"Content-Disposition":f'attachment; filename="{job_id}-onboarding.json"'})
@router.get("/jobs/{job_id}/tasks",response_class=HTMLResponse)
def task_list(request:Request,job_id:str,session:Session=Depends(get_session)):
    return templates.TemplateResponse(request,"partials/tasks.html",{"tasks":session.scalars(select(OnboardingTask).where(OnboardingTask.job_id==job_id).order_by(OnboardingTask.id.desc())).all(),"job_id":job_id})
@router.post("/jobs/{job_id}/tasks",response_class=HTMLResponse)
def task_add(request:Request,job_id:str,title:str=Form(),owner:str=Form(),due_date:str=Form(default=""),session:Session=Depends(get_session)):
    session.add(OnboardingTask(job_id=job_id,title=title.strip(),owner=owner.strip(),due_date=due_date or None,status="todo"));session.commit();return task_list(request,job_id,session)
@router.post("/jobs/{job_id}/tasks/checklist",response_class=HTMLResponse)
def task_checklist(request:Request,job_id:str,candidate_id:str=Form(),owner:str=Form(),joining_date:str=Form(default=""),session:Session=Depends(get_session)):
    job_or_404(session,job_id)
    candidate=session.scalar(select(Candidate).where(Candidate.id==candidate_id,Candidate.job_id==job_id))
    if not candidate: raise HTTPException(422,"Choose a candidate from this requisition")
    title_prefix=f"{candidate.name}: "
    checklist=["Confirm offer acceptance and joining date","Collect required documents","Prepare laptop and system access","Share first-week plan","Schedule manager introduction"]
    for title in checklist:
        exists=session.scalar(select(OnboardingTask).where(OnboardingTask.job_id==job_id,OnboardingTask.candidate_id==candidate_id,OnboardingTask.title==title_prefix+title))
        if not exists: session.add(OnboardingTask(job_id=job_id,candidate_id=candidate_id,title=title_prefix+title,owner=owner.strip() or "Hiring team",due_date=joining_date or None,status="todo"))
    session.commit();return task_list(request,job_id,session)
@router.patch("/jobs/{job_id}/tasks/{task_id}",response_class=HTMLResponse)
def task_toggle(request:Request,job_id:str,task_id:int,session:Session=Depends(get_session)):
    task=session.scalar(select(OnboardingTask).where(OnboardingTask.id==task_id,OnboardingTask.job_id==job_id))
    if task:task.status="done" if task.status!="done" else "todo";session.commit()
    return task_list(request,job_id,session)
