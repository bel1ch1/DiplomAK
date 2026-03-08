from pydantic import BaseModel, Field


class ProcessTextRequest(BaseModel):
    text: str = Field(min_length=1)
    instructions: str = Field(default="")


class ProcessTextResponse(BaseModel):
    edited_text: str
    changes_summary: str


class UploadResponse(BaseModel):
    filename: str
    extracted_text: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    document_text: str = Field(default="")


class ChatResponse(BaseModel):
    answer: str
