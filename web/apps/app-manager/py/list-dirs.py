import cgi, os, json, glob

params = cgi.FieldStorage()
path = params.getvalue('term')

path += "*"

print json.dumps(glob.glob(path))

