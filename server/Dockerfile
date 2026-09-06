FROM ghcr.io/rocker-org/r-ver:4.6.1@sha256:a5df0ae591422cc1733e97da03a9f4eff4cf172e40895225959aa93bb7ff7517 AS r-engine
WORKDIR /app
COPY r/packages.lock.json r/install.R /app/r/
RUN Rscript --vanilla /app/r/install.R

FROM r-engine
ENV DEBIAN_FRONTEND=noninteractive PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 \
    R_DEFAULT_INTERNET_TIMEOUT=300 PATH=/opt/openacad/bin:$PATH HOME=/tmp
RUN sed -i 's|http://|https://|g' /etc/apt/sources.list.d/ubuntu.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv inkscape fonts-noto-cjk fontconfig libgomp1 \
    && rm -rf /var/lib/apt/lists/* && fc-cache -f
WORKDIR /app
COPY requirements.lock /app/requirements.lock
RUN python3 -m venv /opt/openacad && pip install --no-cache-dir -r requirements.lock
COPY app /app/app
COPY r/analyze.R /app/r/analyze.R
COPY tests /app/tests
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin openacad
USER 10001:10001
RUN python -m pytest -q -p no:cacheprovider
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
