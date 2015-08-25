#CLIRA app installation core routines.

import urllib2, cgi, os, json, shutil, urlparse, base64, cgitb, sys, traceback
import time
from itertools import izip_longest

"""
Main wrapper to call various app management  routines depending on params 
passed
"""
def manageApps () :

    #extract the form data
    form = cgi.FieldStorage()
    src = form.getvalue('src')
    mode = form.getvalue('mode')

    if mode == "listApps" :
        res = getAppList()
        if res :
            updateResponse('appList', res)
            send("success", True)
    elif mode == "checkAppUpdate" :
        res = getUpdateInfo(form.getvalue('url'), form.getvalue('version'))
        if res : 
            updateResponse('updateInfo', res)
            send("success", True)
    elif mode == "fetchFileList" :
        filelist = getAppFileList(form.getvalue('name'))
        if filelist :
            updateResponse('fileList', filelist)
            send("success", True)
    elif mode == "getMeta" and getMeta(form.getvalue('name')) :
        send("success", True)
    elif mode == "saveMeta" and saveMeta(form.getvalue('meta')) :
        send("success", True)
    elif mode == "updateApp" and updateApp(form.getvalue('name')):
        send("success", True)
    elif src == "localDisk" and installFromDisk(form) :
        send("success", True)
    elif src == "github" and installFromGithub(form):
        send("success", True)
    elif src == "webServer" and installFromWebServer(form):
        send("success", True)


"""
List installed apps and check for update
"""
def getAppList () :
    appDir = appDirPath()
    appList = []
    dirs = os.listdir(appDir)
    for d in dirs :
        app = {}
        if not d.startswith(('.', '..')) and os.path.isdir(appDir + d):
            app['name'] = d
            metapath = appDir + d + "/" + d + ".meta"
            if not os.path.isfile(metapath) :
                app['meta'] = False
                appList.append(app)
                continue
            try : 
                with open(metapath) as fh :
                    meta = json.load(fh)
                    ret = validateMetaData(meta)
                    if 'error' in ret :
                        app['meta-error'] = ret['error']
                        app['meta'] = meta
                        appList.append(app)
                        continue
                    if 'app-meta-url' not in meta :
                        app['meta-error'] = "No app Update URL"
                    fh.close()
            except (ValueError, IOError) as e :
                app['meta'] = False
                app['meta-error'] = "Failed to load meta file for '" + d + "' : " + e(str)
                appList.append(app)
                continue
            app['meta'] = meta
            appList.append(app)
    return appList

def updateApp (appName) :
    path = appDirPath(appName) + appName + '.meta'
    if not os.path.exists(path) :
        error("Cannot update '" + appName + "'. App not installed or meta file is missing.")
        return False
    meta = getAppMetaData('fileDisk', path)
    if not meta :
        return False
    if 'app-meta-url' not in meta :
        error("Cannot update '" + appName + "', missing 'app-meta-url' from meta file")
        return False
    url = meta['app-meta-url']
    info = getUpdateInfo(url, meta['version'])
    if not info:
        return False
    if not info['new-version'] :
        updateResponse('up-to-date', True)
        return True
    updateResponse('new-version', info['new-version'])
    if not githubInstallCommon(info['meta'], 'update') :
        shutil.rmtree(appDirPath("_" + appName), ignore_errors=True)
        return False
    
    return True

"""
Check if an app has a newer version available using the URL given by the client
"""
def getUpdateInfo (url, version) :
    updateInfo = {}
    if not url :
        updateInfo['error'] = "Missing url field"
        return updateInfo
    if urlparse.urlparse(url).netloc == "github.com" :
        src = "github"
    else : 
        src = None
    meta = getAppMetaData(src, url)
    if meta :
        if 'not-modified' in meta :
            updateInfo['new-version'] = False
        else :
            if compareVersions(version, meta['version']) == -1 :
                updateInfo['new-version'] = meta['version']
            else :
                updateInfo['new-version'] = False
            updateInfo['meta'] = meta
    else :
        return False
    return updateInfo

"""
Compare versions v1, v2 and return :
    -1 if v1 < v2
     1 if v1 > v2
     0 if v1 == v2
"""
def compareVersions (v1, v2) :
    ver1 = (int(n) for n in v1.split('.'))
    ver2 = (int(n) for n in v2.split('.'))
    for i, j in izip_longest(ver1, ver2, fillvalue=0) :
        if i > j :
            return 1
        elif i < j :
            return -1
    return 0

"""
Install an app from disk using the params
"""
def installFromDisk (form) : 
    path = form.getvalue('path')
    try : 
        meta = getAppMetaData('fileDisk', path)
        if not meta:
            return False
        updateResponse('appName', meta["name"])
        srcDir = os.path.dirname(path) + "/"
        destDir = appDirPath(meta["name"])
        files = meta["files"]

        #Create the necessary app directories
        rmAppDir(meta['name'])
        if not createAppDirs(destDir, files) : 
            return False

        #Copy all the app files to the dest
        if not copyAppFiles(srcDir, destDir, files):
            return False
    except (IOError, OSError, ValueError) as e : 
        error(str(e))
        return False
    return True

"""
Use the app meta data and fetch application files using the Github API. 
Download files directly into the destination directory. For each 'file' in the
app meta 'files' field, we create the corresponding Github API URL and fetch
the data. The file content is contained base64 encoded in the 'content' field.
Take that and write to dest location.
"""
def installFromGithub (form) :
    url = form.getvalue('url')
    if not url :
        url = form.getvalue('app-meta-url')
    if not url :
        error("No app src URL defined.")
        return False
    appName = getAppNameFromURL(url)
    if not appName :
        return False
    updateResponse('appName', appName)
    if appInstalled(appName) :
        updateResponse('app-exists' , True)
        error("'" + appName + "' is already installed.")
        return False
    meta = getAppMetaData("github", url)
    if not meta :
        return False
    if not githubInstallCommon(meta, 'install') :
        shutil.rmtree(appDirPath("_" + appName), ignore_errors=True)
        return False
    
    return True

"""
Common set of tasks while installing or updating an app from Github
"""
def githubInstallCommon (meta, mode) :
    files = meta["files"]
    appName = meta['name']
    destDir = appDirPath("_" + appName)

    if not createAppDirs(destDir, files):
        error("Failed to create app directories")
        return False

    #First write the meta file, this prevents an unnecessary api call later
    if not updateAppMetaFile(meta, True):
        return False

    dirUrl = getDirUrl(meta['app-meta-url'])
    if dirUrl[-1] != '/' :
        dirUrl += '/'

    for f in files :
        # Skip writing the meta file, its handled already
        if f.lower().endswith('.meta'):
            continue
        fUrl = getGithubApiUrl(dirUrl + f)
        if not fUrl :
            return False
        fdata = githubApiGetBlob(fUrl)
        if not fdata :
            return False
        if not writeFile(destDir + f, fdata) :
            return False
    if mode == "update" :
        rmAppDir(appName)
    os.rename(destDir, appDirPath(appName))
    return True 

"""
Install an app from a webserver URL
"""
def installFromWebServer (form) :
    url = form.getvalue('url')
    if not url :
        error("Invalid URL")
        return False
    appName = getAppNameFromURL(url)
    if not appName :
        return False
    updateResponse('appName', appName)
    meta = getAppMetaData("webServer", url)
    if not meta :
        return False
    destDir = appDirPath(meta['name'])
    files = meta['files']
    rmAppDir(appName)
    if not createAppDirs(destDir, files) :
        return False

    #First write the meta file, this prevents an unnecessary api call later
    if not updateAppMetaFile(meta, True):
        return False

    dirUrl = getDirUrl(url)
    if dirUrl[-1] != '/' :
        dirUrl += '/'
    for f in files :
        # Skip writing the meta file, its handled already
        if f.lower().endswith('.meta'):
            continue
        res = getURL(dirUrl + f)
        if ('code' or 'reason') in res :
            printHttpError(res, json_content=False)
            return False
        fdata = res['content']
        if not fdata or not writeFile(destDir + f, fdata) :
            return False
    return True
    
"""
Write 'data' to 'dest' file path 
"""
def writeFile (dest, data) :
    try :
        with open(dest, "w") as fh :
            fh.write(data)
            fh.close()
            return True
    except (IOError, OSError) as e : 
        error("Failed to write file to" + dest + " : " + e(str))
    return False

"""
Return the new app directory relative to where we are. This should be changed
to using a CLIRA env variable that stores the clira apps directory rather 
than using this ugly method.
"""
def appDirPath (dirname=None) : 
    if not dirname :
        return os.path.realpath("../../") + "/"
    return os.path.realpath("../../") + "/" + dirname + "/"

def appMetaFile(appName) :
    return appDirPath() + appName + "/" + appName + '.meta'

def getDirUrl (url) :
    o = urlparse.urlparse(url)
    return urlparse.urlunparse((o.scheme, o.netloc, os.path.dirname(o.path), 
        None, None, None))

def appInstalled (appName) :
    return os.path.exists(appDirPath(appName))

def getAppNameFromURL (url) :
    o = urlparse.urlparse(url)
    fname = os.path.basename(o.path)
    if fname.lower().endswith('.meta'):
        (appName, ext) = fname.split('.')
        if appName :
            return appName
    error("Cannot extract app name from URL. Make sure the URL points to an app.meta file")
    return False

def getAppVersion (appName) :
    appMeta = appDirPath() + appName + '/' +appName + '.meta'
    try :
        with open(appMeta) as fh :
            meta = json.load(fh)
            if 'version' in meta :
                return meta['version']
            fh.close()
    except (ValueError, IOError) as e :
        error(str(e))
    return False

def encodeUserData(user, password):
        return "Basic " + (user + ":" + password).encode("base64").rstrip()

"""
Convert a github.com URL to a api.github.com URL. Its easier to copy paste a
github.com URL from the browser. We simply parse its components and create an
equivalent api.github.com URL which allows us to fetch more info about the 
resource.
"""
def getGithubApiUrl (url) :
    try :
        o = urlparse.urlparse(url)
        if not o.netloc == "github.com":
            error("Enter a valid Github URL for the file")
            return False
        (owner, repo, ctype, branch, path) = o.path[1::].split('/', 4)
        if branch == 'master' :
            return "https://api.github.com/repos/{!s}/{!s}/contents/{!s}".format(owner, repo, path)
        else :
            return "https://api.github.com/repos/{!s}/{!s}/contents/{!s}?ref={!s}".format(owner, repo, path, branch)
    except ValueError as e :
        error("Failed to get Github API URL : " + str(e))
    return False

"""
Fetch data using a URL. dataType is json if json decoded object is required as 
result. username and password is optional and is used for HTTP auth.
"""
def getURL (url, dataType = None, username = None, password=None, header=None) :
    try :
        req = urllib2.Request(url)
        if dataType == "json" :
            req.add_header('Accept', 'application/json')
        else :
            req.add_header('Accept', 'text/plain')
        req.add_header("Content-type", "application/x-www-form-urlencoded")
        if username and password :
            req.add_header('Authorization', encodeUserData(username, password))
        if header :
            for k in header.keys():
                req.add_header(k, header[k])
        res = urllib2.urlopen(req)
        if dataType == "json" :
            return { 'content' : json.loads(res.read()),
                     'info' : dict(res.info())
                   }
        else :
            return { 'content' : res.read(),
                     'info' : dict(res.info())
                   }
    except urllib2.HTTPError as e :
        data = {}
        data['code'] = e.code
        data['reason'] = e.reason
        content = e.read()
        if content :
            data['content'] = content
        return data
    except urllib2.URLError as e :
        data = {}
        data['reason'] = str(e.reason)
        return data
    except Exception as e :
        error("Failed to fetch URL : " + str(e))

"""
Query the Github API using the url and return the file/blob content. Throw an
error if we don't see what we want.
"""
def githubApiGetBlob (url, user=None, password=None) :
    res = getURL(url, "json")
    if not res :
        return False
    if ('code' or 'reason') in res :
        printHttpError(res)
        return False
    res = res['content']
    if 'type' not in res or res['type'] != "file":
        error("URL does not point to a file : type => " + res["type"])
        return False
    if "content" not in res :
        error("Missing file content in response")
        return False
    try : 
        return base64.b64decode(res["content"])
    except ValueError as e:
        error("Failed to parse file content : " + str(e))
    return False


"""
Check if a resource has been modified using GITHUB's conditional access API.
If the resource has changed, return the resource else return False.
"""
def githubGetIfModified (url, lastModified) :
    header = {}
    if lastModified :
        header['If-Modified-Since'] = lastModified
    res = getURL(url, 'json', None, None, header)
    if ('code' or 'reason') in res :
        if res['code'] == 304 :
            return { 'not-modified' : True }
        else :
            printHttpError(res)
            return False
    return res

"""
Validate mandatory meta data fields
"""
def validateMetaData (meta) :
    fields = ('name', 'version', 'files')
    for f in fields :
        if f not in meta :
            return { 
                    "error" : "meta file missing mandatory field '" + f + "'",
                    "name" : f
                   }
    return {}

def updateAppMetaFile (data, temp=False):
    if temp :
        path = appDirPath() + "_" + data['name'] + "/" + data['name'] + ".meta"
    else :
        path = appMetaFile(data['name'])
    try :
        with open(path, 'w') as fh :
            json.dump(data, fh, indent=4)
            fh.close()
            return True
    except Exception as e :
        error("Failed to update app meta file : " + str(e))
    return False

def getLastModified (path) :
    try :
        if os.path.isfile(path) :
            mtime = time.gmtime(os.path.getmtime(path))
            return time.strftime("%a, %d %b %Y %H:%M:%S GMT", mtime)
    except Exception as e :
       error(str(e))
    return None


def getAppMetaData (src, url) :
    try :
        if src == "github" :
            url = getGithubApiUrl(url)
            if not url :
                return False
            appName = getAppNameFromURL(url)
            if not appName:
                return False
            path = appMetaFile(appName)
            lastModified = getLastModified(path)
            res = githubGetIfModified(url, lastModified)
            if not res :
                return False
            if 'not-modified' in res :
                return { 'not-modified' : True }
            info = res['info']
            res = res['content']
            if 'content' in res : 
                meta = json.loads(base64.b64decode(res["content"]))
            else :
                error("Failed to find meta file 'content' in response")
                return False

        elif src == "fileDisk" :
            if not os.path.isfile(url):
                error("Invalid file path : " + url)
                return False
            with open(url, 'r') as fh :
                meta = json.load(fh)
                fh.close()
        else :
            res = getURL(url, 'json')
            if ('reason' or 'code') in res :
                printHttpError(res, json_content=False)
                return False
            meta = res['content']

        if meta :
            ret = validateMetaData(meta)
            if 'error' in ret:
                error(ret['error'])
                return False
            else :
                return meta
    except ValueError as e : 
        error("Failed to parse meta file : " + str(e))
    except IOError as e :
        error("Failed to read meta file : " + str(e))
    return False 

def createAppDirs (destDir, files, ) :
    if not mkdirs(destDir):
        return False
    seen = {}
    for f in files :
        path = os.path.dirname(f)
        if not path or path in seen : continue
        seen[path] = True
        if not mkdirs(destDir + path) :
            return False
    return True

def rmAppDir(appName) :
    if appInstalled(appName) :
        shutil.rmtree(appDirPath(appName), ignore_errors=True)

def copyAppFiles (srcDir, destDir, files):
    try :
        for f in files :
            shutil.copy(srcDir + f, destDir + f)
    except (OSError, IOError) as e : 
        error("Error copying file " + f + " : " + str(e))
        return False
    return True

def printHttpError (data, json_content=True) :
    try :
        msg = None
        if 'reason' in data and not 'code' in data :
            error("HTTP error : " + data['reason'])
            return False
        if 'code' in data :
            if 'content' not in data :
                return False
            if json_content :
                content = json.loads(data['content'])
            else :
                content = data['content']
            if 'message' in content :
                msg = content['message']
            if 'documentation_url' in content :
                msg = msg + " More info : " + content['documentation_url']
            if msg :
                error("Github API error: " + msg)
            else :
                error("HTTP error : " + str(data['code']) + " " + data['reason'])
    except ValueError as e :
        error(str(e))

def mkdirs (path) : 
    try :
        if not os.path.exists(path) :
            os.makedirs(path)
    except OSError as e: 
        error(str(e))
        return False
    return True

def getAppFileList (appName) :
    fileList = []
    try : 
        appDir = appDirPath(appName)
        for root, dirs, files in os.walk(appDir):
            for f in files:
                path = os.path.join(root, f)
                path = path.replace(appDir, "")
                fileList.append(path) 
        return fileList
    except Exception as e:
        error(str(e))
    return False


def getMeta(appName) :
    if not appInstalled(appName) :
        error("No such app installed")
        return False
    if not os.path.isfile(appMetaFile(appName)) :
        meta = {}
        meta['name'] = appName
        meta['files'] = getAppFileList(appName)
        updateResponse('metaCreate', True)
        updateResponse('meta', meta)
        return True
    try :
        with open(appMetaFile(appName)) as fh :
            meta = json.load(fh)
            res = validateMetaData(meta)
            if 'error' in res :
                error(res['error'])
                return False
            fh.close()
            updateResponse('meta', meta)
            return True
    
    except Exception as e :
        error(str(e))
    return False

def saveMeta (metaStr) : 
    try : 
        meta = json.loads(metaStr)
        res = validateMetaData(meta)
        if 'error' in res :
            send('metaError', res)
            return False
        appMeta = meta['name'] + '.meta'
        for i, f in enumerate(meta['files']) :
            if f.find("(Will be created)") > -1 :
                meta['files'][i] = appMeta
                break
        if not updateAppMetaFile(meta) :
            return False
        return True
    except ValueError as e :
        error(e(str))
    return False

"""
Update the global response data
"""
def updateResponse (key, value) :
    global response
    response[key] = value

def printResponse () :
    global response
    print json.dumps(response)

def error (msg) :
    updateResponse('error', msg)
    printResponse()

def send (key, value) :
    updateResponse(key, value)
    printResponse()


#Main : Let's do this!
cgitb.enable()
print "Content-Type: application/json\n\n"

#Our global response data which is sent to the client
response = {}

try :
    manageApps()   
except : 
    #For unknown erros we simply send over the traceback to the client
    error(traceback.format_exc())
