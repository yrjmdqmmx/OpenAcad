FROM ghcr.io/rocker-org/r-ver:4.6.1@sha256:a5df0ae591422cc1733e97da03a9f4eff4cf172e40895225959aa93bb7ff7517 AS r-engine
WORKDIR /app
COPY r/packages.lock.json r/install.R /app/r/
ARG TARGETARCH
RUN --mount=type=cache,id=openacad-r-4.6.1-${TARGETARCH},target=/opt/r-build-cache,sharing=locked \
    R_LIBS_USER=/opt/r-build-cache Rscript --vanilla /app/r/install.R \
    && cp -a /opt/r-build-cache/. /usr/local/lib/R/site-library/

FROM r-engine
ARG APT_MIRROR=""
ENV DEBIAN_FRONTEND=noninteractive PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 \
    R_DEFAULT_INTERNET_TIMEOUT=300 PATH=/opt/openacad/bin:$PATH HOME=/tmp
RUN sed -i 's|http://|https://|g' /etc/apt/sources.list.d/ubuntu.sources \
    && if [ -n "$APT_MIRROR" ]; then sed -i -E "s|https://(ports.ubuntu.com/ubuntu-ports\|archive.ubuntu.com/ubuntu\|security.ubuntu.com/ubuntu)|$APT_MIRROR|g" /etc/apt/sources.list.d/ubuntu.sources; fi \
    && apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv inkscape fonts-noto-cjk fontconfig libgomp1 \
    && rm -rf /var/lib/apt/lists/* && fc-cache -f
WORKDIR /app
COPY requirements.lock /app/requirements.lock
RUN python3 -m venv /opt/openacad && pip install --no-cache-dir -r requirements.lock
COPY app /app/app
COPY r/analyze.R /app/r/analyze.R
COPY r/renv.lock /app/r/renv.lock
COPY fonts /usr/local/share/fonts/openacad
RUN printf '%s\n' '<?xml version="1.0"?>' '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">' '<fontconfig><selectfont><rejectfont><glob>/usr/share/fonts/opentype/noto/*</glob></rejectfont></selectfont></fontconfig>' > /etc/fonts/conf.d/99-openacad-fonts.conf && fc-cache -f
COPY scripts /app/scripts
COPY tests /app/tests
COPY requirements-test.lock /app/requirements-test.lock
RUN pip install --no-cache-dir -r requirements-test.lock
RUN useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin openacad
USER 10001:10001
RUN python -m pytest -q -p no:cacheprovider
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--no-access-log"]
