from pathlib import Path
import hashlib,json,subprocess
import numpy as np
from PIL import Image,ImageFilter
root=Path(__file__).parent/'serif';manifest=json.loads((root/'manifest.json').read_text());report=[]
for platform in ['chromium','mobile']:
    ref=Image.open(root/(platform+'-chinese-serif.svg.png')).convert('RGB')
    row={'platform':platform,'svgDimensions':ref.size,'comparisons':[]}
    for fmt in ['png','pdf','eps']:
        original=root/(platform+'-chinese-serif.'+fmt)
        if fmt in ['pdf','eps']:
            raster=root/(platform+'-chinese-serif.'+fmt+'.png')
            subprocess.run(['/opt/homebrew/bin/gs','-q','-dSAFER','-dBATCH','-dNOPAUSE','-dEPSCrop','-dUseCropBox','-sDEVICE=png16m','-r96','-dTextAlphaBits=4','-dGraphicsAlphaBits=4','-sOutputFile='+str(raster),str(original)],check=True,stdout=subprocess.DEVNULL)
        else:raster=original
        im=Image.open(raster).convert('RGB');size=im.size
        assert abs(size[0]/size[1]-ref.width/ref.height)<.003
        expected_scale=150/96 if fmt=='png' else 1
        assert max(abs(size[i]-ref.size[i]*expected_scale) for i in [0,1])<=2
        pixels=np.asarray(im);ink=np.min(pixels,axis=2)<235;ys,xs=np.where(ink)
        assert len(xs)>500 and xs.min()>0 and ys.min()>0 and xs.max()<im.width-1 and ys.max()<im.height-1
        resized=im.resize(ref.size,Image.Resampling.LANCZOS)
        a=np.asarray(ref.filter(ImageFilter.GaussianBlur(1)),dtype=float);b=np.asarray(resized.filter(ImageFilter.GaussianBlur(1)),dtype=float)
        blur=float(np.abs(a-b).mean()/255)
        assert blur<.02,(platform,fmt,blur)
        result={'format':fmt,'dimensions':size,'independentOpen':True,'inkBounds':[int(xs.min()),int(ys.min()),int(xs.max()),int(ys.max())],'blurMae':blur}
        if fmt=='pdf':
            fonts=subprocess.check_output(['/opt/homebrew/bin/pdffonts',str(original)],text=True)
            (root/(platform+'-pdf-fonts.txt')).write_text(fonts)
            serif=[line.split() for line in fonts.splitlines()[2:] if 'NotoSerif' in line]
            assert serif and all(line[-5]=='yes' for line in serif)
            result['serifFontsEmbedded']=True
            result['fontNames']=[line[0] for line in serif]
        row['comparisons'].append(result)
    report.append(row)
(root/'independent-verification.json').write_text(json.dumps({'files':8,'allOpened':True,'rows':report},indent=2)+'\n')
print(json.dumps(report,indent=2))
