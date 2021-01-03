const progress = { start: 0, now: 0, value: function () { return 1 - (this.now / this.start) } }
class JAVDoeSearcher {

    static searchAll() {
        const params = PersistanceManager.getParams();
        progress.start = progress.now = params.length;
        PageManager.progress(progress.value())
        return Promise.all(params.map(current => { if (current && current.length) return JAVDoeSearcher.searchByKey(current) }))
    }

    static searchByKey(current) {
        if (!(current && current.length)) return Promise.reject("No length in key")
        const href = `https://javdoe.tv/search/movie/${current}.html`;
        return JAVDoeSearcher.createDomFromURL(href, current);
    }
 
    static createDomFromURL(href, key) {
        console.log({ href });
        
        return new Promise(resolve => {
            $.get(href, body => {
                progress.now--;
                PageManager.progress(progress.value())
                return resolve({ body, key })
            }).fail(error => {
                console.log('An error has occurred', error);
                console.log('Trying again in 30 seconds');
                setTimeout(() => {
                    console.log('Trying again...');
                    JAVDoeSearcher.createDomFromURL(href, key).then(resolve)
                }, 29999)
            })
        })
    }

}

class PersistanceManager {

    static cleanKey(key) {
        var re;
        if (re = /(\w+)\-(\d+)/.exec(key)) {
            var num = re[2];
            if (num > 99) num = parseInt(num);
            return `${re[1]}-${num}`;
        }
        return false;
    }

    static isVRFile(key) {
        var re, suf;
        if (re = /(\w+)\-(\d+)/.exec(key)) {
            suf = re[1].substr(re[1].length - 2).toLowerCase();
            return suf == 'vr';
        }
        return false;
    }

    static setParams(address) {

        PersistanceManager.clear();
        if (address.indexOf('^') >= 0) {
            var tmp = address.split('^');
            LocalStorage.autoDmm = atob(tmp[1]);
            address = tmp[0];
        }
        else if (address.indexOf('*') >= 0) {
            var tmp = address.split('*');
            console.warn('temp-->', tmp[1]);
            LocalStorage.autoUrl = atob(tmp[1]);
            address = tmp[0];
        }

        const _addresses = address.split('/').filter(f => !PersistanceManager.isVRFile(f)).map(f => PersistanceManager.cleanKey(f))
            .filter(n => n && n.length);
        const addresses = [];
        const db = {}
        _addresses.map(f => db[f] = !0)
        for (var n in db) addresses.push(n);
        console.log({ addresses })

        LocalStorage.savedItems = '[]';
        LocalStorage.javdoeParams = addresses.join('/');
        LocalStorage.paramSize = addresses.length;

    }

    static getParams() {
        const param = LocalStorage.javdoeParams;
        return param.split('/').filter(n => n && n.length);
    }

    static remove(key) {
        const old = LocalStorage.savedItems || '[]';
        const saved = JSON.parse(old);
        const shed = saved.filter(f => f.key != key)
        LocalStorage.savedItems = JSON.stringify(shed);
        return true
    }

    static clear() {
        LocalStorage.savedItems = '';
        LocalStorage.javdoeParams = '';
        LocalStorage.paramSize = '';
        LocalStorage.autoUrl = '';
        LocalStorage.autoDmm = '';
    }

    static save(key, title, image, URL) {
        const old = LocalStorage.savedItems || '[]';
        const saved = JSON.parse(old);
        saved.push({
            key, title, image, URL
        });
        PersistanceManager.setSavedItems(saved);
        PageManager.status(PersistanceManager.getParams(), `${title} added`);
        return true
    }

    static setSavedItems(saved) {

        LocalStorage.savedItems = JSON.stringify(saved);
    }

    static getSavedItems() {

        const old = LocalStorage.savedItems || '[]';
        return JSON.parse(old);
    }

    static getAutoObj() {
        const auto = LocalStorage.autoUrl;
        console.log({ auto })
        if (auto && auto.length) {
            const obj = JSON.parse(auto);
            if (obj && obj.page) return obj;
        }
        return false;
    }

    static getDmmObj() {
        const auto = LocalStorage.autoDmm;
        if (auto && auto.length) {
            console.warn({ auto })
            const obj = JSON.parse(auto);
            if (obj && obj.href) {
                const regex = /page=(\d+)/
                var re;
                if (re = regex.exec(obj.href)) {
                    let page = re[1];
                    page++
                    obj.href = obj.href.replace(regex, `page=${page}`);
                    return obj
                }
                obj.href = `${obj.href}page=2/`;
                return obj
            }
        }
        return false;
    }

    static getAutoURL() {
        const obj = PersistanceManager.getAutoObj();
        const dmm = PersistanceManager.getDmmObj();
        const saved = PersistanceManager.getSavedItems().map(f => f.key).join('/');
        const href = ['http://www.javlibrary.com/en/'];

        if (dmm && dmm.href) {
            const b64 = btoa(dmm.href)
            href.push(`#auto${saved}#auto${b64}`);
        } else if (obj) {
            const crumb = []
            obj.page++;
            for (var n in obj) {
                if (n != 'screen') {
                    crumb.push(`${n}=${obj[n]}`)
                }
            }
            href.push(obj.screen, '?', crumb.join('&'), `#auto${saved}`);
        } else {
            href.push(`#find${saved}`);
        }

        return href.join('');
    }
}

class PageManager {

    static head() {

        return $('#header .top-notice .container');
    }
    static write(track) {
        const button = $(`
        <div class="col-md-3 col-sm-6 text-center main-item" id="thumb_${track.key}">
            <div class="wrap-main-item">
                <a class="main-thumb" href="javascript:void(0)" target="_blank" title="${track.title}">
                <img class="placeholder iswatched" src="${track.image}" data-src="${track.image}" data-id="134537" 
                        data-cnt="0" data-path="" data-ext="" style="height: 147.656px;">
                <span class="bagde">HD</span>
                <span class="time-video"><input checked value='${track.URL}' class='saved' type='checkbox'/></span>
                </a>
                <div class="wrap-item-meta">
                <h3><a href="javascript:void(0)" title="${track.title}">${track.title}</a></h3>
                
            </div>
            </div>
        </div>`);
        if (track.saved) button.css({ 'border': 'solid 2px red' })
        button.on('click', () => {
            PersistanceManager.remove(track.key);
            PageManager.status(PersistanceManager.getParams(), `${track.title} removed`);
        });
        return button;
    }

    static results(size) {

        const saved = PersistanceManager.getSavedItems();
        const row = $('<div class="row"></div>');

        if (saved && saved.length) {

            row.append($(`
            <div class="col-md-12 col-xs-12">
                <h2 class="text-left">Search Results</h2>
            </div>`));
            for (var i in saved) {
                if (!saved[i].saved) {
                    row.append(PageManager.write(saved[i]));
                }
            }
        }


        return row;
    }

    static progress(percent) {
        const head = PageManager.head(); 
        var value = Math.floor(25 * percent)
        for (var j = [], i = 0; ++i < value; j.push('|'));
        for (var z = [], i = value; ++i < 25; z.push('|'));
        var black = $('<span style="color:white">' + j.join('') + '</span>')
        var gray = $('<span style="color:gray">' + z.join('') + '</span>');
        var label = $(`<div>${progress.now} of ${progress.start}</div>`);        
        head.empty().append(black, gray, label);
        return PageManager.footer(head); 
    }

    static footer(head) {
        
        const auto = PersistanceManager.getAutoObj();
        const dmm = PersistanceManager.getDmmObj();
        const href = PersistanceManager.getAutoURL();
        const old = LocalStorage.savedItems || '[]';
        const saved = JSON.parse(old);
        if (dmm && dmm.href) {
            const stopper = $('<input id="autox" type="checkbox" checked>');
            stopper.on('click', () => {
                LocalStorage.autoDmm = '';
                PageManager.status(params, 'auto-load cancelled')
            })
            head.append(stopper, $(` <label for="autox"> automatically add items and return to <a href="${dmm.href}" target="_blank">${dmm.href}</label>`));
        }
        else if (auto) {
            const stopper = $('<input id="autox" type="checkbox" checked>');
            stopper.on('click', () => {
                LocalStorage.autoUrl = '';
                PageManager.status(params, 'auto-load cancelled')
            })
            head.append(stopper, $(` <label for="autox"> automatically add items and return to <a href="${href}" target="_blank">${auto.title}</a>, page ${auto.page}</label>`));
        }
        else if (saved.length) {
            const button = $('<button>Save Selected Videos</button>');
            button.on('click', () => {
                JAVDoeReader.addSelected()
            })
            head.append(button);
        }

    }

    static status(params, text) {
        const head = PageManager.head()
        const auto = PersistanceManager.getAutoObj();
        const dmm = PersistanceManager.getDmmObj();
        const href = PersistanceManager.getAutoURL()

        console.warn('status', text);

        head.empty()

        if (params && params.join) {
            head.html(`${params.length} items remaining<br/>:: ${text}`);
        } else head.html(text);

        head.append(PageManager.results(params.length))

        return PageManager.footer(head); 

    }

}

class JAVDoeReader {
    static dispose() {
        const href = PersistanceManager.getAutoURL();
        PersistanceManager.clear();
        if (href) {
            return location.href = href;
        }
        return self.close();
    }

    static start() {
        var jq = document.createElement('script');
        jq.onload = JAVDoeReader.init;
        jq.src = "https://code.jquery.com/jquery-2.1.1.min.js";
        document.querySelector('head').appendChild(jq)
    }

    static add(URLList, idx, pos) {
        var index = idx == undefined ? (URLList.length - 1) : idx
        if (!pos) pos = 20;
        if (index > -1) {
            const item = URLList[index];
            const address = item.URL;
            item.saved = !0;
            PersistanceManager.setSavedItems(URLList);
            PageManager.status(PersistanceManager.getParams(), `${item.title} saved`)
            window.open(address, address, `width=480,height=380,toolbar=0,top=${pos},left=${pos}`)
            return setTimeout(() => {
                JAVDoeReader.add(URLList, --index, pos += 40);
            }, 2500);
        }
        return JAVDoeReader.dispose();
    }

    static addSelected() {
        const saved = PersistanceManager.getSavedItems();
        JAVDoeReader.add(saved);
    }

    static close() {

        const dmm = PersistanceManager.getDmmObj();
        const auto = PersistanceManager.getAutoObj();
        if (auto || dmm) {
            return setTimeout(() => {
                JAVDoeReader.addSelected();
            }, 2999)
        }
        console.log('Done');
    }

    static search() {
        const params = PersistanceManager.getParams();
        PageManager.status(params, `Looking up ${params.length} items...`)
        if (!params.length) return JAVDoeReader.close();

        JAVDoeSearcher.searchAll()
            .then(bodies => {
                console.log(bodies.length)
                if (bodies.length) {
                    const retry = [];
                    var count = 0;
                    bodies.map(dom => {
                        const track = JAVDoeReader.read(params, dom.key, dom.body);
                        if (track) {
                            if (track.href) {
                                console.warn({ track })
                                retry.push(track)
                                return
                            } else if (track.error) {
                                return
                            }
                            PersistanceManager.save(track.current, track.title, track.image, track.targetURL);
                            count++
                        }
                    })
                    PageManager.status(params, `Added ${count} items...`)
                    if (retry.length) {
                        PageManager.status(params, `Looking up ${retry.length} items...`);
                        progress.start = progress.now = retry.length;
                        Promise.all(retry.map(track => JAVDoeSearcher.createDomFromURL(track.href, track.current)))
                            .then(bodies => {
                                bodies.map(dom => {
                                    const track = JAVDoeReader.read(params, dom.key, dom.body);
                                    if (track && !track.error) {
                                        PersistanceManager.save(track.current, track.title, track.image, track.targetURL)
                                    }
                                })
                            })
                    }

                    JAVDoeReader.close();
                }
            })
    }

    static begin(address) {
        console.warn(address)
        PersistanceManager.setParams(address);
        PageManager.status(PersistanceManager.getParams(), "Starting...")
        JAVDoeReader.search();
        return
    }

    static getImage(text) {
        var re
        const regex = /<meta property="og:image" content="([^"]*?)"/
        if (re = regex.exec(text)) return re[1]
    }

    static read(params, current, body) {

        const dom = $(body);
        const frame = dom.find('iframe');
        const meta = dom.find('meta');
        const thumb = dom.find('.movie-thumb'); // thumbnails
        const panel = dom.find('.tabs-panel'); // this is a search results page
        const box = dom.find('.select-all');

        if (panel.length) { // no results where found
            if (thumb.length) {
                return { current, href: thumb.attr('href') };
            }
            return false;
        }

        const locale = box.val();
        const title = dom.find('.wrap-breadcrumb .breadcrumb .active').text();
        const image = JAVDoeReader.getImage(body)
        const targetURL = `${API.endpoints.ApiHost}/video?URL=${locale}`;

        if (locale.toLowerCase().indexOf(current.toLowerCase()) < 0) {
            return { error: `${current} mismatch!!` };
        }

        return { current, title, image, targetURL }

    }
 
    static init() {
        console.log("Ready.");
        var href = location.href.split("#");
        const head = $('#header .top-notice .container');

        if (href[1]) {
            return JAVDoeReader.begin(href[1])
        }
    }
}


JAVDoeReader.start();


class AppResource {

    constructor() {
        this.endpoints = {
            "ApiHost": ""
        }

        this.Services = {
            Parser: this.create(this.endpoints.ApiHost + "/parser"),
            Model: this.create(this.endpoints.ApiHost + "/model"),
            Video: this.create(this.endpoints.ApiHost + "/video"),
            Tag: this.create(this.endpoints.ApiHost + "/tag"),
        }
    }

    create(address) {

        return {
            get: (params, fn) => {
                $.get(address, params, fn)
            },
            post: (body, fn) => {
                return $.ajax({
                    type: 'POST',
                    url: address,
                    contentType: "application/json",
                    dataType: 'text',
                    success: fn,
                    data: JSON.stringify(body),
                    error: e => {
                        alert(e.message);
                    }
                });
            },
            put: (body, fn) => {
                return $.post(address, body, fn)
            }
        }
    }
}

const API = new AppResource();
const LocalStorage = {
    savedItems: '',
    javdoeParams: '',
    paramSize: '',
    autoUrl: '',
    autoDmm: '',
}
