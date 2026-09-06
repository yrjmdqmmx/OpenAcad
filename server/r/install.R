options(timeout=300, Ncpus=2)
repo <- "https://packagemanager.posit.co/cran/2026-09-06"
if (!requireNamespace("jsonlite", quietly=TRUE)) install.packages("jsonlite", repos=repo)
lock <- jsonlite::fromJSON("/app/r/packages.lock.json")
stopifnot(as.character(getRversion()) == lock$R)
needed <- Filter(function(name) !requireNamespace(name, quietly=TRUE) || packageVersion(name) != package_version(lock$packages[[name]]), names(lock$packages))
if(length(needed)) install.packages(needed, repos=lock$repository, dependencies=c("Depends","Imports","LinkingTo"))
for (name in names(lock$packages)) {
  if (packageVersion(name) != package_version(lock$packages[[name]])) stop(paste("包版本与锁文件不一致：", name))
}
