"""Verify the cached asset pipeline reproduces committed hero bytes.
python tools/qa/stage-1/rebuild.py <output directory>
"""
import hashlib, json, pathlib, platform, subprocess, sys, time
import numpy
from PIL import __version__ as pillow_version
root = pathlib.Path(__file__).resolve().parents[3]
out = pathlib.Path(sys.argv[1]).resolve(); out.mkdir(parents=True, exist_ok=True)
files = sorted((root/'assets/hero').glob('*'))
def hashes():
    return {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files if p.is_file()}
before = hashes(); started = time.perf_counter()
run = subprocess.run([sys.executable, 'tools/hero/build.py'], cwd=root, text=True, capture_output=True)
after = hashes()
(out/'build.log').write_text(run.stdout + run.stderr)
record = {'command':'python tools/hero/build.py', 'exit':run.returncode, 'seconds':time.perf_counter()-started,
          'source_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),
          'runtime':{'python':platform.python_version(),'numpy':numpy.__version__,'pillow':pillow_version},
          'byte_identical':before==after, 'before':before,'after':after,
          'sizes':{p.name:p.stat().st_size for p in files if p.is_file()}}
(out/'reproducibility.json').write_text(json.dumps(record,indent=2))
print(json.dumps({k:record[k] for k in ['exit','seconds','byte_identical','runtime']}))
if run.returncode or before != after: raise SystemExit(1)
