#!/usr/bin/python

"""
List all the app js files within the CLIRA apps directory. Hide 'admin' apps
based on the 'admin' field in the app meta file.
"""

import cgi, os, json

appDir = "../apps"

#Check if we are admin
admin = os.getenv('CLIRA_ADMIN')

print "Content-Type: application/json\n\n"

fileList = []

try :
    for d in os.listdir(appDir):
        meta = appDir + "/" + d + "/" + d + ".meta"
        js =  appDir + "/" + d + "/" + d + ".js"
        if os.path.isfile(meta) and os.path.isfile(js) :
            with open(meta) as fh :
                content = json.load(fh)
                if ('admin' in content and content['admin'] 
                        and not admin):
                    fh.close()
                    continue
                js = js.replace("..", "");
                fileList.append(js)
                fh.close()
    res = {}
    res['files'] = fileList
    print json.dumps(res)

except Exception as e :
    res = {}
    res['error'] = str(e)
    print json.dumps(res)
        
