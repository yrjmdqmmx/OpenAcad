suppressPackageStartupMessages(library(jsonlite))
s <- mgcv::s
options(warn=1)
req <- fromJSON(paste(readLines(file("stdin"), warn=FALSE), collapse="\n"), simplifyVector=FALSE)
p <- req$params
param <- function(name, default) if (is.null(p[[name]])) default else p[[name]]
fail <- function(message, code="INVALID_DATA") { e <- simpleError(message); class(e)<-c("openacad_error",class(e)); attr(e,"code")<-code; stop(e) }
need <- function(test,message) if(!isTRUE(test)) fail(message)
diagnostics <- list()
record <- function(code,message) diagnostics[[length(diagnostics)+1]] <<- list(code=code,message=message)
mat <- function(t) { a<-do.call(rbind,lapply(t$values,unlist)); storage.mode(a)<-"double"; rownames(a)<-unlist(t$rowLabels); colnames(a)<-unlist(t$columnLabels); a }
find_table <- function(role) { ts<-Filter(function(t)identical(t$role,role),req$tables); label<-switch(role,response="响应矩阵",environment="环境矩阵",control="独立控制矩阵（control）",community="群落矩阵",role); need(length(ts)==1,paste0("需要且只能提供一份",label)); ts[[1]] }
align_matrix <- function(a,ids) { need(setequal(rownames(a),ids),"数据表的样本 ID 不一致"); a[ids,,drop=FALSE] }
ecology_methods <- c("bray","manhattan","euclidean","canberra","clark","kulczynski","jaccard","gower","altGower","morisita","horn","mountford","raup","binomial","chao","cao","mahalanobis","chisq","chord","hellinger","aitchison")
eco_dist <- function(a,method) {
  need(method %in% ecology_methods,"未知生态距离方法")
  if(!method %in% c("manhattan","euclidean","mahalanobis")) need(all(a>=0),paste0(method," 距离需要非负数据"))
  if(!method %in% c("manhattan","euclidean","canberra","mahalanobis")) need(all(rowSums(abs(a))>0),paste0(method," 距离不能包含全零行"))
  if(method=="morisita") need(all(a==floor(a)) && all(rowSums(a)>1),"Morisita 距离需要整数计数，且各行总数大于 1")
  if(method=="mahalanobis") need(nrow(a)>ncol(a) && qr(cov(a))$rank==ncol(a),"马氏距离的协方差矩阵不可逆")
  if(method=="aitchison") need(all(a>0)||param("pseudocount",0)>0,"Aitchison 距离含零值，请显式指定正伪计数")
  d<-vegan::vegdist(a,method=method,binary=FALSE,na.rm=FALSE,pseudocount=param("pseudocount",0))
  need(all(is.finite(d)),paste0(method," 对此数据产生未定义距离，请检查空行、零方差和计数条件")); d
}
as_rows <- function(a) unname(as.matrix(a))
result <- tryCatch(withCallingHandlers({
  method<-req$method
  set.seed(as.integer(param("seed",1)),kind="L'Ecuyer-CMRG")
  if(method=="pcoa") {
    t<-req$tables[[1]]; d<-as.matrix(do.call(rbind,lapply(t$distances,unlist)))
    correction<-param("correction","none"); need(correction %in% c("none","lingoes","cailliez"),"PCoA 修正方法无效")
    fit<-ape::pcoa(as.dist(d),correction=correction)
    vectors<-if(correction!="none"&&!is.null(fit$vectors.cor)) fit$vectors.cor else fit$vectors
    eigen<-if(correction!="none"&&"Corr_eig"%in%names(fit$values)) fit$values$Corr_eig else fit$values$Eigenvalues
    original<-fit$values$Eigenvalues; positive<-eigen[eigen>1e-12]
    need(ncol(vectors)>=2,"PCoA 不足两个正特征轴，无法生成二维图")
    if(any(original < -1e-10)) record("NEGATIVE_EIGENVALUES","PCoA 包含负特征值；解释率按所绘正特征值总和计算，请查看分析方法")
    list(scores=as_rows(vectors),rowLabels=t$rowLabels,eigenvalues=I(eigen),explainedRatio=I(positive/sum(positive)),negativeEigenvalueSum=sum(abs(original[original<0])),correction=correction)
  } else if(method=="nmds") {
    t<-req$tables[[1]]; a<-mat(t); k<-param("dimensions",2)
    need(nrow(a)>2*k+1,"NMDS 样本数必须大于维数的两倍加一")
    need(param("tryMax",100)>=param("try",20),"最大随机起点次数不能小于最少次数")
    d<-eco_dist(a,param("distance","bray"))
    fit<-vegan::metaMDS(d,k=k,try=param("try",20),trymax=param("tryMax",100),engine="monoMDS",autotransform=FALSE,wascores=FALSE,halfchange=FALSE,trace=FALSE,parallel=1)
    converged<-isTRUE(fit$converged>0)
    if(!converged) record("NMDS_NOT_REPEATED","NMDS 尚未重复找到稳定解，请增加随机起点次数并检查数据")
    list(scores=as_rows(fit$points),rowLabels=t$rowLabels,stress=fit$stress,converged=converged,tries=fit$tries,dimensions=k)
  } else if(method %in% c("cca","rda")) {
    ty<-find_table("response"); te<-find_table("environment"); y<-mat(ty); e<-align_matrix(mat(te),rownames(y))
    need(nrow(y)>=3&&ncol(y)>=2,"约束排序至少需要 3 个样本和 2 个响应变量")
    need(all(apply(e,2,sd)>0),"环境矩阵不能包含常量列")
    need(qr(cbind(1,e))$rank==ncol(e)+1,"环境变量存在完全共线关系，请删除重复或线性相关列")
    if(method=="cca") need(all(y>=0)&&all(rowSums(y)>0)&&all(colSums(y)>0),"CCA 响应数据必须非负且不能包含全零行或列")
    env_names<-colnames(e); colnames(e)<-make.names(colnames(e),unique=TRUE)
    frame<-as.data.frame(e)
    fit<-if(method=="cca") vegan::cca(y~.,data=frame,na.action=na.fail) else vegan::rda(y~.,data=frame,scale=FALSE,na.action=na.fail)
    need(!is.null(fit$CCA)&&length(fit$CCA$eig)>=2,"有效约束轴不足 2 个，无法生成二维约束排序图")
    scaling<-param("scaling",2); need(scaling%in%c(1,2),"排序缩放必须为 1 或 2")
    scores<-vegan::scores(fit,display=c("sites","species","bp"),choices=seq_along(fit$CCA$eig),scaling=scaling)
    eig<-fit$CCA$eig
    list(scores=as_rows(scores$sites),rowLabels=ty$rowLabels,loadings=as_rows(scores$species),columnLabels=ty$columnLabels,environmentVectors=as_rows(scores$biplot),environmentLabels=I(env_names),eigenvalues=I(unname(eig)),explainedRatio=I(unname(eig/fit$tot.chi)),constrainedExplainedRatio=I(unname(eig/sum(eig))),totalInertia=fit$tot.chi,constrainedInertia=sum(eig),scaling=scaling)
  } else if(method %in% c("lm","loess","gam")) {
    need(length(req$tables)==1,"回归分析需要一份数据表")
    t<-req$tables[[1]]; a<-mat(t); groups<-unlist(t$groups); out<-list()
    for(group in unique(groups)) {
      idx<-which(groups==group); df<-data.frame(x=a[idx,1],y=a[idx,2]); ids<-unlist(t$rowLabels)[idx]
      need(nrow(df)>=3&&length(unique(df$x))>=2,paste0("组“",group,"”需要至少 3 个观测和 2 个不同 x"))
      grid<-data.frame(x=seq(min(df$x),max(df$x),length.out=param("points",200))); level<-param("confidence",.95)
      model<-list(method=method,n=nrow(df))
      if(method=="lm") {
        fit<-stats::lm(y~x,data=df,na.action=na.fail,singular.ok=FALSE)
        pr<-stats::predict(fit,newdata=grid,interval="confidence",level=level)
        sm<-summary(fit); model$formula<-"y = intercept + slope * x"; model$coefficients<-as.list(coef(fit)); model$rSquared<-sm$r.squared; model$p<-sm$coefficients[2,4]; model$rank<-fit$rank; model$residualDf<-fit$df.residual
      } else if(method=="loess") {
        degree<-param("degree",2); need(degree%in%c(1,2),"LOESS 多项式次数必须为 1 或 2")
        need(length(unique(df$x))>=degree+2,"LOESS 不同 x 数量不足")
        fit<-stats::loess(y~x,data=df,span=param("span",.5),degree=degree,family="gaussian",normalize=TRUE,na.action=na.fail,control=loess.control(surface="direct",statistics="exact"))
        pred<-predict(fit,newdata=grid,se=TRUE); margin<-qt((1+level)/2,pred$df)*pred$se.fit; pr<-cbind(pred$fit,pred$fit-margin,pred$fit+margin)
        model$formula<-"y ~ loess(x)"; model$residualDf<-pred$df
      } else {
        need(length(unique(df$x))>=4,"GAM 至少需要 4 个不同 x")
        k<-min(param("basisDimension",10),length(unique(df$x))-1)
        if(k<param("basisDimension",10)) record("GAM_BASIS_REDUCED",paste0("组“",group,"”不同 x 数量有限，GAM 基维数已调整为 ",k))
        fit<-mgcv::gam(y~s(x,bs="tp",k=k),data=df,family=gaussian(),method="REML",na.action=na.fail)
        pred<-predict(fit,newdata=grid,se.fit=TRUE,unconditional=TRUE); margin<-qnorm((1+level)/2)*pred$se.fit; pr<-cbind(pred$fit,pred$fit-margin,pred$fit+margin)
        sm<-summary(fit); model$formula<-paste0("y ~ s(x, bs='tp', k=",k,") [REML]");model$edf<-unname(sm$s.table[1,1]);model$p<-unname(sm$s.table[1,ncol(sm$s.table)]);model$rSquared<-sm$r.sq
      }
      need(all(is.finite(pr)),paste0("组“",group,"”拟合不稳定，请增加样本或调整平滑参数"))
      curve<-lapply(seq_len(nrow(grid)),function(i)list(x=grid$x[i],y=unname(pr[i,1]),lower=unname(pr[i,2]),upper=unname(pr[i,3])))
      observations<-lapply(seq_len(nrow(df)),function(i)list(id=ids[i],x=df$x[i],y=df$y[i]))
      out[[length(out)+1]]<-list(name=group,observations=observations,curve=curve,model=model)
    }
    list(series=out)
  } else if(method %in% c("mantel","mantel.randtest","mantel.rtest","mantel.partial")) {
    te<-find_table("environment"); env<-mat(te); communities<-Filter(function(t)identical(t$role,"community"),req$tables)
    need(nrow(env)>=4,"Mantel 检验至少需要 4 个样本")
    need(length(communities)>0,"Mantel 检验需要至少一份群落数据")
    corr<-param("correlation","pearson");need(corr%in%c("pearson","spearman","kendall"),"Mantel 相关方法无效")
    if(method!="mantel") need(corr=="pearson","此 Mantel 实现只支持 Pearson")
    permutations<-param("permutations",999); edges<-list()
    if(method=="mantel.partial") {
      control<-align_matrix(mat(find_table("control")),rownames(env)); z<-eco_dist(control,param("controlDistance","euclidean"))
    }
    for(t in communities) {
      a<-align_matrix(mat(t),rownames(env)); x<-eco_dist(a,param("speciesDistance","bray"))
      for(j in seq_len(ncol(env))) {
        y<-eco_dist(env[,j,drop=FALSE],param("environmentDistance","euclidean"))
        need(sd(as.numeric(x))>0&&sd(as.numeric(y))>0,"Mantel 距离矩阵没有变化，无法计算相关")
        fit<-switch(method,mantel=vegan::mantel(x,y,method=corr,permutations=permutations,na.rm=FALSE,parallel=1),mantel.partial=vegan::mantel.partial(x,y,z,method="pearson",permutations=permutations,na.rm=FALSE,parallel=1),mantel.randtest=ade4::mantel.randtest(x,y,nrepet=permutations),mantel.rtest=ade4::mantel.rtest(x,y,nrepet=permutations))
        r<-if(method%in%c("mantel","mantel.partial")) unname(fit$statistic) else unname(fit$obs)
        pv<-if(method%in%c("mantel","mantel.partial")) fit$signif else fit$pvalue
        need(is.finite(r)&&is.finite(pv),"Mantel 结果未定义，请检查控制矩阵是否完全相关")
        edges[[length(edges)+1]]<-list(source=t$id,target=colnames(env)[j],r=r,p=pv,n=nrow(env))
      }
    }
    adjustment<-param("pAdjust","none");need(adjustment%in%c("none","BH","BY","holm","bonferroni"),"P 值校正方法无效")
    q<-p.adjust(vapply(edges,function(e)e$p,0),method=adjustment)
    for(i in seq_along(edges)) edges[[i]]$adjustedP<-q[i]
    list(edges=edges,method=method,permutations=permutations,seed=param("seed",1),alternative="greater")
  } else fail("未知 R 分析方法","UNKNOWN_METHOD")
},warning=function(w) {
  raw<-conditionMessage(w)
  message<-if(grepl("stress.*(nearly|close)|stress is zero",raw,ignore.case=TRUE)) "NMDS stress 接近零，可能因数据点不足或距离关系过于简单；请结合样本数量解释" else if(grepl("span too small|pseudoinverse|near singular",raw,ignore.case=TRUE)) "局部拟合接近奇异，请增大 LOESS 平滑跨度或增加不同 x 的观测" else if(grepl("essentially perfect fit",raw,ignore.case=TRUE)) "数据几乎完全符合回归模型，误差与置信区间估计可能不稳定" else if(grepl("not converg",raw,ignore.case=TRUE)) "模型未充分收敛，请检查数据并调整拟合参数" else "计算产生方法学提示，请检查样本数量、秩与拟合稳定性"
  record("R_WARNING",message);invokeRestart("muffleWarning")
}),error=function(e) {
  list(error=list(code=if(inherits(e,"openacad_error")) attr(e,"code") else "STATISTICAL_ERROR",message=if(inherits(e,"openacad_error")) conditionMessage(e) else "统计计算未完成，请检查数据的样本数量、方差、秩及方法适用条件"))
})
if(is.null(result$error)) {
  packages<-c("vegan","mgcv","ape","ade4","jsonlite")
  result$provenance<-list(engine="R",r=as.character(getRversion()),rPackages=setNames(lapply(packages,function(n)as.character(packageVersion(n))),packages),rng="L'Ecuyer-CMRG")
  result$diagnostics<-diagnostics
}
cat(toJSON(result,auto_unbox=TRUE,matrix="rowmajor",null="null",na="null",digits=16,force=TRUE))
