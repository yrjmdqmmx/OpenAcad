options(repos=c(CRAN="https://packagemanager.posit.co/cran/2026-09-06"))
lock<-jsonlite::fromJSON("/app/r/packages.lock.json")
args<-commandArgs(trailingOnly=TRUE); args<-args[args!="--args"]
renv::snapshot(project="/app", lockfile=args[1], packages=names(lock$packages), prompt=FALSE, force=TRUE)
