options(timeout=300, Ncpus=2)
unlink(list.files(.libPaths()[1], pattern="^00LOCK", full.names=TRUE), recursive=TRUE)
repo <- "https://packagemanager.posit.co/cran/2026-09-06"
if (!requireNamespace("jsonlite", quietly=TRUE)) install.packages("jsonlite", repos=repo)
lock <- jsonlite::fromJSON("/app/r/packages.lock.json")
stopifnot(as.character(getRversion()) == lock$R)
for (attempt in 1:3) {
  needed <- Filter(function(name) !isTRUE(tryCatch(packageVersion(name, lib.loc=.libPaths()) == package_version(lock$packages[[name]]), error=function(e)FALSE)), names(lock$packages))
  if(!length(needed)) break
  install.packages(needed, repos=lock$repository, dependencies=c("Depends","Imports","LinkingTo"))
}
for (name in names(lock$packages)) {
  if (packageVersion(name, lib.loc=.libPaths()) != package_version(lock$packages[[name]])) stop(paste("包版本与锁文件不一致：", name))
}
