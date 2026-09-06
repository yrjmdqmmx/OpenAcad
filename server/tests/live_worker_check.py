"""Opt-in local acceptance against the named disposable QA worker container."""
import datetime as dt
import json
from pathlib import Path
import subprocess
import time
import httpx
from redis import Redis
from rq.results import Result
from app.job_state import CapabilityJob
from rq.serializers import JSONSerializer


def main():
    client = httpx.Client(base_url='http://127.0.0.1:18082', timeout=10)
    redis = Redis.from_url('redis://127.0.0.1:17639/0')
    reports = []
    def r_processes():
        command = "from pathlib import Path; import json; print(json.dumps([int(p.name) for p in Path('/proc').iterdir() if p.name.isdigit() and (p/'comm').exists() and (p/'comm').read_text().strip()=='R']))"
        return json.loads(subprocess.check_output(['docker','exec','openacad-qa-worker','python','-c',command], text=True))
    for action in ['hard-kill', 'cancel']:
        rows = [[f's{i}', *[1+((i*7+j*11+i*j)%37) for j in range(12)]] for i in range(160)]
        payload = {'kind':'analysis','method':'nmds','data':{'tables':[{'id':'lifecycle-probe','role':'matrix','columns':['sample']+[f'sp{j}' for j in range(12)],'rows':rows}]},'params':{'try':100,'trymax':100,'seed':731}}
        response = client.post('/api/jobs',json=payload); assert response.status_code==202, response.text
        job = response.json(); path = '/api/jobs/'+job['id']; auth = {'Authorization':'Bearer '+job['token']}
        for _ in range(100):
            state = client.get(path,headers=auth).json()
            pids = r_processes()
            if state['status']=='started' and pids: break
            assert state['status'] not in ('finished','failed'), state
            time.sleep(.1)
        assert len(pids)==1
        if action=='hard-kill':
            code = f"import os,signal; from pathlib import Path; s=Path('/proc/{pids[0]}/status').read_text(); parent=int(next(x.split()[1] for x in s.splitlines() if x.startswith('PPid:'))); assert parent>2; os.kill(parent,signal.SIGKILL)"
            subprocess.run(['docker','exec','openacad-qa-worker','python','-c',code], check=True)
            for _ in range(100):
                state = client.get(path,headers=auth).json()
                if state['status']=='failed': break
                time.sleep(.1)
            assert state['status']=='failed', state
            saved = CapabilityJob.fetch(job['id'],connection=redis,serializer=JSONSerializer)
            assert not saved.args and not saved.kwargs
            cap_ttl = redis.pttl('openacad:cap:'+job['id'])
            data_ttl = redis.pttl(saved.key)
            result_ttl = redis.pttl(Result.get_key(job['id']))
            assert 0<data_ttl<=cap_ttl+20 and 0<result_ttl<=cap_ttl+20
            reports.append({'case':action,'startedRealR':True,'failedStatus':True,'inputRemoved':True,'capabilityRemainingMs':cap_ttl,'jobRemainingMs':data_ttl,'resultRemainingMs':result_ttl})
        assert client.delete(path,headers=auth).status_code==200
        assert client.get(path,headers=auth).status_code==404
        for _ in range(50):
            if not r_processes(): break
            time.sleep(.1)
        assert not r_processes()
        time.sleep(.2)
        assert not redis.exists('rq:job:'+job['id']) and not redis.exists(Result.get_key(job['id']))
        assert client.get('/api/health').status_code==200
        subprocess.run(['docker','exec','openacad-qa-worker','python','-m','app.worker_health'], check=True)
        reports.append({'case':action+'-delete','jobRemoved':True,'resultRemoved':True,'rChildRemoved':True,'capabilityRevoked':True,'workerHealthy':True})
    Path('tests/artifacts/worker-lifecycle-check.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n')
    print('真实硬杀/取消通过：父进程清输入、原TTL不延长、任务/结果不重建、R子进程退出、worker继续健康')


if __name__ == '__main__':
    main()
