from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, StrictFloat, StrictInt, StrictStr, model_validator


Cell = StrictStr | StrictInt | StrictFloat | None


class Table(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(default="数据表", max_length=200)
    role: str = Field(default="matrix", max_length=30)
    columns: list[str] = Field(min_length=1, max_length=10000)
    rows: list[list[Cell]] = Field(min_length=1, max_length=100000)

    @model_validator(mode="after")
    def rectangular(self):
        if len(set(self.columns)) != len(self.columns) or any(not c.strip() for c in self.columns):
            raise ValueError("列名不能为空或重复")
        for i, row in enumerate(self.rows):
            if len(row) != len(self.columns):
                raise ValueError(f"第 {i + 2} 行有 {len(row)} 个单元格，应为 {len(self.columns)} 个")
        return self


class JobData(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tables: list[Table] = Field(default_factory=list, max_length=64)
    svg: str | None = Field(default=None, max_length=10000000)
    sequences: str | None = Field(default=None, max_length=20000000)


class JobRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: Literal["analysis", "export"]
    method: str = Field(min_length=1, max_length=60)
    data: JobData
    params: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def size(self):
        if sum(len(t.rows) * len(t.columns) for t in self.data.tables) > 1000000:
            raise ValueError("数据超过 100 万个单元格，请拆分后重试")
        ids = [t.id for t in self.data.tables]
        if len(ids) != len(set(ids)):
            raise ValueError("数据表 ID 不能重复")
        return self
