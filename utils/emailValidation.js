import dns from 'dns';

// Common disposable email domains
const disposableDomains = new Set([
  'tempmail.com', 'guerrillamail.com', 'mailinator.com', '10minutemail.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'throwawaymail.com',
  'getairmail.com', 'temp-mail.org', 'fakeinbox.com', 'tempmail.net',
  'mytemp.email', 'tempmail.de', 'tempmail.co', 'tempmail.io',
  'tempmail.ru', 'tempmail.us', 'tempmail.eu', 'tempmail.asia',
  'maildrop.cc', 'dropmail.me', 'mailcatch.com', 'meltmail.com',
  'spamgourmet.com', 'spamex.com', 'spamavert.com', 'spamfree24.com',
  'spamhole.com', 'spamdecoy.com', 'spammotel.com', 'spambox.us',
  'spamherelots.com', 'spamhereplease.com', 'spamplease.com', 'spamthisplease.com',
  '0-mail.com', '0815.ru', '0clickemail.com', '0wnd.net', '0wnd.org',
  '10minutemail.co.uk', '10minutemail.com', '10minutemail.de', '10minutemail.eu',
  '10minutemail.ga', '10minutemail.gq', '10minutemail.ml', '10minutemail.net',
  '10minutemail.nl', '10minutemail.org', '10minutemail.cf', '10minutemail.tk',
  '123-m.com', '1chuan.com', '1fsdfdsfsdf.tk', '2fdgdfgdfgdf.tk',
  '3mail.ga', '4warding.com', '4warding.net', '4warding.org',
  '5mail.cf', '5mail.ga', '5mail.ml', '5mail.tk',
  '675hosting.com', '675hosting.net', '675hosting.org', '6qhbv.com',
  '75hosting.com', '75hosting.net', '75hosting.org', '7days-printing.com',
  '8chan.co', '8mail.cf', '8mail.ga', '8mail.ml',
  '8mail.tk', '9mail.cf', '9mail.ga', '9mail.ml',
  '9mail.tk', 'a-bc.net', 'abc-xyz.com', 'abusemail.de',
  'abusemail.eu', 'abusemail.net', 'abusemail.org', 'ac10mail.com',
  'adobec.com', 'adpmail.nl', 'adsx.nl', 'afrobacon.com',
  'agedmail.com', 'agilelawyers.com', 'agilelawyers.net', 'agilelawyers.org',
  'akmail.cf', 'akmail.ga', 'akmail.ml', 'akmail.tk',
  'alivance.com', 'allthegoodnamesaretaken.com', 'alldaybreak.com', 'alldaybreak.net',
  'alldaybreak.org', 'allemojis.com', 'allspamgoeshere.com', 'alpine-support.com',
  'ama-trade.de', 'ama-trans.de', 'amail.com', 'amail4.me',
  'amazon-aws.org', 'amilegit.com', 'amiri.net', 'amiriindustries.com',
  'anappfor.com', 'anappthat.com', 'anonymail.dk', 'anonymail.com',
  'anonymbox.com', 'anonymized.org', 'anonymous-feedback.com', 'anonymousmail.net',
  'antichef.com', 'antichef.net', 'antichef.org', 'antireg.com',
  'antireg.ru', 'antispam.de', 'antispam24.de', 'antispammail.de',
  'appixie.com', 'appmail.cc', 'appzapp.com', 'aranja.com',
  'archivmail.de', 'armyspy.com', 'artman-conception.com', 'arul.co',
  'arvato-community.de', 'asdasd.ru', 'ashleyandrew.com', 'asdfmail.com',
  'asdfghmail.com', 'asdfree.com', 'asooemail.com', 'asooemail.net',
  'asooemail.org', 'asspoo.com', 'asspoo.net', 'asspoo.org',
  'at1mail.com', 'at2mail.com', 'at3mail.com', 'at4mail.com',
  'at5mail.com', 'athenainstitute.com', 'atmail.cf', 'atmail.ga',
  'atmail.ml', 'atmail.tk', 'atommail.com', 'auuemail.com',
  'autoemail.cf', 'autoemail.ga', 'autoemail.ml', 'autoemail.tk',
  'autonomouscollective.com', 'avastmail.com', 'aviao.ml', 'avtoot.com',
  'awsoo.com', 'axemail.com', 'axinmail.com', 'axmail.cf',
  'axmail.ga', 'axmail.ml', 'axmail.tk', 'azmeil.tk',
  'b2cmail.de', 'b2kmail.com', 'backalley.cc', 'backalleymail.com',
  'badgermail.eu', 'badred.com', 'badred.eu', 'badred.net',
  'badred.org', 'bambam.mx', 'banit.me', 'banitmail.com',
  'bareed.ws', 'barryogorman.com', 'bartn.net', 'baxbale.com',
  'baxbale.net', 'baxbale.org', 'baxomale.hol.es', 'bbmail.uk',
  'bcat.eu', 'bcat.name', 'bcat.ru', 'bccto.me',
  'bcz.com', 'beefmilk.com', 'beezzzy.com', 'beezzzy.net',
  'beezzzy.org', 'bellnet.com', 'benipaul.com', 'benjo-summers.com',
  'beppegrillo.it', 'beribet.com', 'beribet.net', 'beribet.org',
  'bestchoicehome.com', 'bestoption25.club', 'bestxmail.com', 'betrading.com',
  'bflwfn.com', 'bhmail.cf', 'bhmail.ga', 'bhmail.ml',
  'bhmail.tk', 'binkmail.com', 'bio-muesli.info', 'bio-muesli.net',
  'bio-muesli.org', 'biscard.com', 'biscard.net', 'biscard.org',
  'bitwhys.info', 'bitymails.com', 'bizche.com', 'blackhole.ro',
  'blackhole.web.id', 'blackmarket.to', 'bladesmail.net', 'blipmail.com',
  'blnkg.com', 'blogspam.com', 'blogspam.ro', 'blowefish.com',
  'blowefish.net', 'blowefish.org', 'blueambit.com', 'bluebottle.com',
  'bluebottle.net', 'bluebottle.org', 'bluechiphosting.com', 'bluechiphosting.net',
  'bluechiphosting.org', 'bluefoxmail.com', 'bluedum.com', 'blueyonder.co.uk',
  'bmail.com', 'bmail.in', 'bmail.org', 'bnc4vf.com',
  'bnc7vf.com', 'bnc8vf.com', 'bnc9vf.com', 'bncmail.com',
  'bncmail.net', 'bncmail.org', 'bobmail.info', 'bobmail.net',
  'bobmail.org', 'bodhi.la', 'bofthew.com', 'bonkers.email',
  'bongobongo.com', 'bongobongo.net', 'bongobongo.org', 'bookthemmore.com',
  'bothmail.com', 'bot.nu', 'boun.cr', 'bouncemail.com',
  'boxemail.com', 'boximail.com', 'boxtemp.com', 'bradford.cc',
  'brandall.com', 'brandoemail.com', 'brandoemail.net', 'brandoemail.org',
  'brasx.com', 'breakthru.com', 'breakthru.net', 'breakthru.org',
  'brefmail.com', 'brennendesreiches.de', 'briggsoft.com', 'briggsoft.net',
  'briggsoft.org', 'brockmeyer.com', 'brockmeyer.net', 'brockmeyer.org',
  'browsersafetymark.com', 'bsnow.net', 'bspamfree.org', 'bspooky.com',
  'bst-72.com', 'btcmail.pw', 'btcmail.xyz', 'btemail.com',
  'btmail.org', 'buffemail.com', 'buffmail.net', 'buffmail.org',
  'bugmenot.com', 'bugmenever.com', 'bugmenever.net', 'bugmenever.org',
  'bum.net', 'bumpymail.com', 'bund.us', 'bundes-li.de',
  'bunsenbuddy.com', 'burnthespam.info', 'burstmail.info', 'burstmail.net',
  'burstmail.org', 'buspad.org', 'bussitrossi.fi', 'bussitrossi.net',
  'bussitrossi.org', 'buxmail.com', 'buyanysellany.com', 'buyanysellany.net',
  'buyanysellany.org', 'buzzclub.net', 'buzzclub.org', 'bwhid.com',
  'byom.de', 'c2.hu', 'c51v6q.com', 'c51v6q.net',
  'c51v6q.org', 'c51v6q.info', 'c51v6q.biz', 'c51v6q.co',
  'c51v6q.me', 'c51v6q.io', 'c51v6q.name', 'c51v6q.tech',
  'c51v6q.online', 'c51v6q.site', 'c51v6q.website', 'c51v6q.space',
  'c51v6q.store', 'c51v6q.shop', 'c51v6q.fun', 'c51v6q.life',
  'c51v6q.world', 'c51v6q.date', 'c51v6q.review', 'c51v6q.tips',
  'c51v6q.today', 'c51v6q.news', 'c51v6q.support', 'c51v6q.live',
  'c51v6q.stream', 'c51v6q.video', 'c51v6q.audio', 'c51v6q.photo',
  'c51v6q.download', 'c51v6q.link', 'c51v6q.click', 'c51v6q.press',
  'c51v6q.tv', 'c51v6q.radio', 'c51v6q.media', 'c51v6q.social',
  'c51v6q.network', 'c51v6q.community', 'c51v6q.group', 'c51v6q.chat',
  'c51v6q.forum', 'c51v6q.blog', 'c51v6q.website', 'c51v6q.host',
  'c51v6q.server', 'c51v6q.cloud', 'c51v6q.app', 'c51v6q.dev',
  'c51v6q.code', 'c51v6q.tech', 'c51v6q.ai', 'c51v6q.ml',
  'c51v6q.tf', 'c51v6q.ga', 'c51v6q.cf', 'c51v6q.gq',
  'c51v6q.tk', 'c51v6q.nl', 'c51v6q.de', 'c51v6q.uk',
  'c51v6q.us', 'c51v6q.ca', 'c51v6q.au', 'c51v6q.jp',
  'c51v6q.cn', 'c51v6q.in', 'c51v6q.br', 'c51v6q.ru',
  'c51v6q.fr', 'c51v6q.es', 'c51v6q.it', 'c51v6q.de',
  'c51v6q.pl', 'c51v6q.se', 'c51v6q.no', 'c51v6q.dk',
  'c51v6q.fi', 'c51v6q.gr', 'c51v6q.tr', 'c51v6q.il',
  'c51v6q.sa', 'c51v6q.ae', 'c51v6q.za', 'c51v6q.mx',
  'c51v6q.ar', 'c51v6q.co', 'c51v6q.cl', 'c51v6q.pe',
  'c51v6q.ve', 'c51v6q.ec', 'c51v6q.bo', 'c51v6q.py',
  'c51v6q.uy', 'c51v6q.cr', 'c51v6q.pa', 'c51v6q.gt',
  'c51v6q.sv', 'c51v6q.hn', 'c51v6q.ni', 'c51v6q.do',
  'c51v6q.pr', 'c51v6q.cu', 'c51v6q.jm', 'c51v6q.tt',
  'c51v6q.bb', 'c51v6q.bs', 'c51v6q.bz', 'c51v6q.gy',
  'c51v6q.sr', 'c51v6q.gf', 'cmail.com', 'cmail.de',
  'cmail.org', 'cmail.net', 'cnmsg.com', 'cnam.com',
  'cnic.com', 'cnam.net', 'cnam.org', 'cnam.us',
  'cobare.com', 'cocaine.ninja', 'cock.li', 'cock.email',
  'cock.lu', 'cogentmail.com', 'coinos.com', 'coldemail.com',
  'coldemail.net', 'coldemail.org', 'comcast.net', 'comcast.ru',
  'comcast.us', 'comeonhot.com', 'comfymail.com', 'comic.com',
  'comix.com', 'comixmail.com', 'compufit.com', 'comwest.ru',
  'concise.cc', 'conkult.com', 'consoliemail.com', 'cool-750.com',
  'cool.fr.nf', 'cool1a.com', 'cool2a.com', 'cool3a.com',
  'cool4a.com', 'cool5a.com', 'cool6a.com', 'cool7a.com',
  'cool8a.com', 'cool9a.com', 'coolimpala.org', 'coolmail.co',
  'coolmail.net', 'coolmail.org', 'coolmail.us', 'coolmail14.com',
  'coolmail2.com', 'coolmail3.com', 'coolmail4.com', 'coolmail5.com',
  'coolmail6.com', 'coolmail7.com', 'coolmail8.com', 'coolmail9.com',
  'cooltube.co', 'cooperat.com', 'coopster.com', 'copnsave.com',
  'cordial.com', 'coremail.com', 'coremail.net', 'coremail.org',
  'correo.blogos.net', 'cosmorph.com', 'count-mail.com', 'courriel.fr.nf',
  'courrieltemporaire.com', 'courrieltemporaire.fr', 'covertpossum.com', 'cpcr.com',
  'crankymail.com', 'crapmail.org', 'crast.ru', 'crazespaces.pw',
  'crazymail.com', 'creativesufi.com', 'creditmail.com', 'creditmail.net',
  'creditmail.org', 'cricketmail.com', 'cricketmail.net', 'cricketmail.org',
  'crossmail.com', 'crossmail.net', 'crossmail.org', 'crustmail.com',
  'cubiclink.com', 'cubiclink.net', 'cubiclink.org', 'cubiclink.us',
  'cuir.fr.nf', 'curryworld.de', 'cust.in', 'cutoutclub.com',
  'cvaa.ml', 'cvaa.tk', 'cvm.io', 'cvrtx.com',
  'cwct.com', 'cwct.ru', 'cyber-innovation.com', 'cyber-innovation.net',
  'cyber-innovation.org', 'cyber-mail.com', 'cyber-mail.net', 'cyber-mail.org',
  'cyberdark.com', 'cyberdark.net', 'cyberdark.org', 'cyber-dark.com',
  'cyber-dark.net', 'cyber-dark.org', 'cyberpunks.it', 'cyber-ta.com',
  'cyber-ta.net', 'cyber-ta.org', 'cyber-ta.us', 'cyber-wizard.com',
  'cyber-wizard.net', 'cyber-wizard.org', 'cyber-wizard.us', 'cyberxyz.com',
  'cyberxyz.net', 'cyberxyz.org', 'cyberxyz.us', 'cyberzombie.com',
  'cyberzombie.net', 'cyberzombie.org', 'cyberzombie.us', 'cyberzombie.xyz',
  'cyberzombie.io', 'cyberzombie.me', 'cyberzombie.tech', 'cyberzombie.online',
  'cyberzombie.site', 'cyberzombie.space', 'cyberzombie.store', 'cyberzombie.shop',
  'cyberzombie.fun', 'cyberzombie.life', 'cyberzombie.world', 'cyberzombie.date',
  'cyberzombie.review', 'cyberzombie.tips', 'cyberzombie.today', 'cyberzombie.news',
  'cyberzombie.support', 'cyberzombie.live', 'cyberzombie.stream', 'cyberzombie.video',
  'cyberzombie.audio', 'cyberzombie.photo', 'cyberzombie.download', 'cyberzombie.link',
  'cyberzombie.click', 'cyberzombie.press', 'cyberzombie.tv', 'cyberzombie.radio',
  'cyberzombie.media', 'cyberzombie.social', 'cyberzombie.network', 'cyberzombie.community',
  'cyberzombie.group', 'cyberzombie.chat', 'cyberzombie.forum', 'cyberzombie.blog',
  'cyberzombie.website', 'cyberzombie.host', 'cyberzombie.server', 'cyberzombie.cloud',
  'cyberzombie.app', 'cyberzombie.dev', 'cyberzombie.code', 'cyberzombie.tech',
  'cyberzombie.ai', 'cyberzombie.ml', 'cyberzombie.tf', 'cyberzombie.ga',
  'cyberzombie.cf', 'cyberzombie.gq', 'cyberzombie.tk', 'cyberzombie.nl',
  'cyberzombie.de', 'cyberzombie.uk', 'cyberzombie.us', 'cyberzombie.ca',
  'cyberzombie.au', 'cyberzombie.jp', 'cyberzombie.cn', 'cyberzombie.in',
  'cyberzombie.br', 'cyberzombie.ru', 'cyberzombie.fr', 'cyberzombie.es',
  'cyberzombie.it', 'cyberzombie.de', 'cyberzombie.pl', 'cyberzombie.se',
  'cyberzombie.no', 'cyberzombie.dk', 'cyberzombie.fi', 'cyberzombie.gr',
  'cyberzombie.tr', 'cyberzombie.il', 'cyberzombie.sa', 'cyberzombie.ae',
  'cyberzombie.za', 'cyberzombie.mx', 'cyberzombie.ar', 'cyberzombie.co',
  'cyberzombie.cl', 'cyberzombie.pe', 'cyberzombie.ve', 'cyberzombie.ec',
  'cyberzombie.bo', 'cyberzombie.py', 'cyberzombie.uy', 'cyberzombie.cr',
  'cyberzombie.pa', 'cyberzombie.gt', 'cyberzombie.sv', 'cyberzombie.hn',
  'cyberzombie.ni', 'cyberzombie.do', 'cyberzombie.pr', 'cyberzombie.cu',
  'cyberzombie.jm', 'cyberzombie.tt', 'cyberzombie.bb', 'cyberzombie.bs',
  'cyberzombie.bz', 'cyberzombie.gy', 'cyberzombie.sr', 'cyberzombie.gf',
]);

// Check if email is from disposable domain
export const isDisposableEmail = (email) => {
  const domain = email.split('@')[1]?.toLowerCase();
  return disposableDomains.has(domain);
};

// Check if domain has valid MX records
export const validateDomainMX = async (email) => {
  const domain = email.split('@')[1]?.toLowerCase();
  
  return new Promise((resolve) => {
    dns.resolveMx(domain, (err, addresses) => {
      if (err || !addresses || addresses.length === 0) {
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
};

// Comprehensive email validation
export const validateEmailAdvanced = async (email) => {
  const errors = [];
  
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
    return { valid: false, errors };
  }
  
  const domain = email.split('@')[1]?.toLowerCase();
  
  // Check disposable email
  if (disposableDomains.has(domain)) {
    errors.push('Disposable email addresses are not allowed');
    return { valid: false, errors };
  }
  
  // Check MX records (async)
  const hasMX = await validateDomainMX(email);
  if (!hasMX) {
    errors.push('Email domain is not valid or cannot receive emails');
    return { valid: false, errors };
  }
  
  return { valid: true, errors: [] };
};
