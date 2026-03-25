from sqlalchemy import String, Text, Integer, ForeignKey, ARRAY, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
import enum

class Project(Base):
  __tablename__ = "projects"

  id: Mapped[int] = mapped_column(Integer, primary_key=True)
  name: Mapped[str] = mapped_column(String(255))
  repo_url: Mapped[str] = mapped_column(String(500), unique=True)
  description: Mapped[str | None] = mapped_column(Text)

  tickets: Mapped[list["Ticket"]] = relationship(back_populates="project")

class Complexity(enum.Enum):
  beginner = "beginner"
  intermediate = "intermediate"
  advanced = "advanced"

class Priority(enum.Enum):
  high = "high"
  medium = "medium"
  low = "low"

class TicketStatus(enum.Enum):
  open = "open"
  in_progress = "in_progress"
  done = "done"


class Ticket(Base):
  __tablename__ = "tickets"

  id: Mapped[int] = mapped_column(Integer, primary_key=True)
  project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"))
  title: Mapped[str] = mapped_column(String(500))
  description: Mapped[str | None] = mapped_column(Text)
  complexity: Mapped[Complexity] = mapped_column(SAEnum(Complexity))
  priority: Mapped[Priority] = mapped_column(SAEnum(Priority))
  status: Mapped[TicketStatus] = mapped_column(SAEnum(TicketStatus), default=TicketStatus.open)
  file_references: Mapped[list[str] | None] = mapped_column(ARRAY(String))

  project: Mapped["Project"] = relationship(back_populates="tickets")
