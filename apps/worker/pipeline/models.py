import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Document(Base):
    __tablename__ = 'documents'
    
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=True)
    original_name = Column(String, nullable=True)
    s3_key = Column(String, nullable=True)
    status = Column(String, nullable=True)
    target_lang = Column(String, nullable=True)
    result = Column(JSONB, nullable=True)
    created_at = Column(DateTime)
    
    metadata_record = relationship("ProjectMetadata", back_populates="document", uselist=False, cascade="all, delete-orphan")
    pages = relationship("Page", back_populates="document", cascade="all, delete-orphan", order_by="Page.page_number")

class ProjectMetadata(Base):
    __tablename__ = 'project_metadata'
    
    meta_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doc_id = Column(String, ForeignKey('documents.id', ondelete='CASCADE'), nullable=False, unique=True)
    world_bible_json = Column(JSONB, nullable=True) # Will be populated by Gemini
    
    document = relationship("Document", back_populates="metadata_record")

class Page(Base):
    __tablename__ = 'pages'
    
    page_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    doc_id = Column(String, ForeignKey('documents.id', ondelete='CASCADE'), nullable=False)
    page_number = Column(Integer, nullable=False)
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    
    document = relationship("Document", back_populates="pages")
    segments = relationship("SourceSegment", back_populates="page", cascade="all, delete-orphan", order_by="SourceSegment.block_index")

class SourceSegment(Base):
    __tablename__ = 'source_segments'
    
    seg_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    page_id = Column(UUID(as_uuid=True), ForeignKey('pages.page_id', ondelete='CASCADE'), nullable=False)
    block_index = Column(Integer, nullable=False)
    original_text = Column(Text, nullable=False)
    bbox = Column(JSON, nullable=False) # [x0, y0, x1, y1]
    
    page = relationship("Page", back_populates="segments")
    translations = relationship("Translation", back_populates="segment", cascade="all, delete-orphan")

class Translation(Base):
    __tablename__ = 'translations'
    
    trans_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seg_id = Column(UUID(as_uuid=True), ForeignKey('source_segments.seg_id', ondelete='CASCADE'), nullable=False)
    target_language = Column(String, nullable=False)
    translated_text = Column(Text, nullable=False)
    
    segment = relationship("SourceSegment", back_populates="translations")
