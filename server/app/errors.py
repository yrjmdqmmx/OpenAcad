class AnalysisError(ValueError):
    def __init__(self, message, code="INVALID_DATA", *, table=None, row=None, column=None):
        super().__init__(message)
        self.detail = {"code": code, "message": message}
        self.detail.update({k: v for k, v in {"table": table, "row": row, "column": column}.items() if v is not None})


def require(condition, message, code="INVALID_DATA", **location):
    if not condition:
        raise AnalysisError(message, code, **location)
