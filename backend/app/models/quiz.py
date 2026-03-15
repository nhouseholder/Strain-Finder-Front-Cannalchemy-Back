"""Pydantic models for quiz request/response validation."""
from pydantic import BaseModel, Field


class QuizRequest(BaseModel):
    effects: list[str] = Field(default_factory=list)
    effectRanking: list[str] = Field(default_factory=list)
    tolerance: str | None = None
    avoidEffects: list[str] = Field(default_factory=list)
    consumptionMethod: str | None = None
    budget: str | None = None
    openToDeals: bool = True
    subtype: str = "no_preference"
    thcPreference: str = "no_preference"
    cbdPreference: str = "no_preference"
    flavors: list[str] = Field(default_factory=list)


class TerpeneInfo(BaseModel):
    name: str
    pct: str


class CannabinoidInfo(BaseModel):
    name: str
    value: float
    color: str


class ForumPro(BaseModel):
    effect: str
    pct: int
    baseline: int


class ForumCon(BaseModel):
    effect: str
    pct: int
    baseline: int


class ForumAnalysis(BaseModel):
    totalReviews: str
    sentimentScore: float
    pros: list[ForumPro]
    cons: list[ForumCon]
    sources: str


class SommelierNotes(BaseModel):
    taste: str = ""
    aroma: str = ""
    smoke: str = ""
    burn: str = ""


class SommelierScores(BaseModel):
    taste: int = 7
    aroma: int = 7
    smoke: int = 7
    throat: int = 7
    burn: int = 7


class EffectPrediction(BaseModel):
    effect: str
    probability: float
    confidence: float
    pathway: str


class PathwayInfo(BaseModel):
    molecule: str
    receptor: str
    ki_nm: float | None = None
    action_type: str = ""
    effect_contribution: str = ""
    confidence: float = 0.5


class Lineage(BaseModel):
    self_name: str = Field(default="", alias="self")
    parents: list[str] = Field(default_factory=list)
    grandparents: dict[str, list[str]] = Field(default_factory=dict)

    model_config = {"populate_by_name": True}


class StrainResult(BaseModel):
    name: str
    type: str
    matchPct: int
    thc: float = 0.0
    cbd: float = 0.0
    genetics: str = ""
    lineage: Lineage = Field(default_factory=Lineage)
    effects: list[str] = Field(default_factory=list)
    terpenes: list[TerpeneInfo] = Field(default_factory=list)
    cannabinoids: list[CannabinoidInfo] = Field(default_factory=list)
    whyMatch: str = ""
    forumAnalysis: ForumAnalysis | None = None
    sentimentScore: float = 0.0
    sommelierNotes: SommelierNotes = Field(default_factory=SommelierNotes)
    sommelierScores: SommelierScores = Field(default_factory=SommelierScores)
    bestFor: list[str] = Field(default_factory=list)
    notIdealFor: list[str] = Field(default_factory=list)
    description: str = ""
    effectPredictions: list[EffectPrediction] = Field(default_factory=list)
    pathways: list[PathwayInfo] = Field(default_factory=list)
    reason: str = ""  # Only for aiPicks


class IdealProfile(BaseModel):
    terpenes: list[dict] = Field(default_factory=list)
    cannabinoids: dict = Field(default_factory=dict)
    subtype: str = ""


class RecommendationResponse(BaseModel):
    strains: list[StrainResult]
    aiPicks: list[StrainResult]
    idealProfile: IdealProfile | None = None
