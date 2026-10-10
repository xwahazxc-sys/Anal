from jobagent import ats
from jobagent.models import Profile

P = Profile.model_validate({
    "name": "A", "contacts": {"email": "a@b.c", "phone": "1"}, "summary": "s",
    "skills": ["Python", "FastAPI", "Postgres", "Docker", "Kafka"],
    "experience": [{"company": "X", "title": "Dev", "start": "2022-03", "bullets": ["Cut latency by 40% with Redis"]}],
})


def test_clean_profile_scores_high():
    assert ats.check(P, P).score >= 95


def test_bad_date_and_missing_email():
    bad = P.model_copy(update={"contacts": {}, "experience": [P.experience[0].model_copy(update={"start": "March 2022"})]})
    rep = ats.check(bad, bad)
    assert rep.score < 85 and any("YYYY-MM" in i for i in rep.issues)


def test_keyword_coverage():
    rep = ats.check(P, P, "Need Python FastAPI Kubernetes Terraform engineer")
    assert rep.keyword_coverage is not None and "kubernetes" in rep.missing_keywords
