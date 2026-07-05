// wordFrequencyData.js  (AUTO-GENERATED from src/data/wordFrequency.ts — do not edit by hand)
// High-frequency English word set used to estimate vocabulary difficulty of a page.
// Exposed on window as DysAssistWordFreq so the (non-module) content scripts can use it.
// A word NOT in this set is treated as "difficult" for a struggling reader.
(function (root) {
  "use strict";
  var COMMON_WORDS_LIST = [
  "a","abandon","ability","able","about","above","absence","absolute","abstract","abuse","academic","accept",
  "access","accident","accommodate","according","account","accurate","accuse","achieve","acknowledge","acquire","across","act",
  "action","active","activity","actual","actually","adapt","add","addition","address","adequate","adjacent","adjust",
  "administration","admire","admit","adoption","adult","advance","advantage","advice","advocate","affect","afford","afraid",
  "after","aftermath","afternoon","afterwards","again","age","agency","agent","aggregate","aggressive","ago","agree",
  "agriculture","ahead","aim","air","alert","alive","all","alliance","allocate","allow","almost","alone",
  "along","already","also","alternative","although","always","am","ambiguous","amend","among","amount","an",
  "analogy","analysis","ancient","and","animal","announce","annual","another","answer","any","anyone","anything",
  "apart","apparent","appeal","appear","apply","appreciation","approach","appropriate","approval","approximately","april","arbitrary",
  "architecture","are","area","arguably","argue","arise","arm","around","arrangement","array","arrive","art",
  "artefact","as","aside","ask","aspect","assertion","assess","assessment","assign","assist","assume","assumption",
  "at","atmosphere","attach","attempt","attend","attention","attitude","attract","august","authentic","authority","autumn",
  "available","avenue","average","avoid","award","aware","away","back","bad","balance","base","basis",
  "battle","be","beach","beat","beautiful","because","become","been","before","begin","behalf","behaviour",
  "behind","believe","below","benefit","best","better","between","beyond","bias","big","birth","black",
  "block","blood","blow","blue","board","body","bond","book","border","born","boss","both",
  "bottom","boundary","boy","brain","break","bridge","bring","broad","broke","brought","brown","budget",
  "build","burden","burn","but","by","call","camera","campaign","can","candidate","capable","capacity",
  "capital","captain","card","care","career","carry","case","cat","catch","category","cause","caution",
  "ceiling","center","certain","chair","challenge","chance","change","character","characteristic","charge","check","chief",
  "child","choice","choose","city","civil","claim","class","clean","clear","close","cold","collaborate",
  "collapse","colleague","combine","come","commerce","commission","commit","common","communicate","community","compensation","competence",
  "complement","complete","complex","compliance","component","comprehensive","comprise","conception","concern","conclusion","condition","conduct",
  "confident","confirm","conflict","connect","consecutive","consequence","conservative","consider","consistency","constant","constraint","construction",
  "contain","context","continent","continue","contradiction","contribute","control","controversy","cooperation","coordinate","corner","corruption",
  "cost","could","council","country","course","crisis","criterion","crucial","culture","current","cut","damage",
  "dark","data","day","dead","deal","debate","decade","december","decide","decision","dedication","deep",
  "defence","definition","demand","democracy","demonstrate","depend","derive","describe","design","desire","despite","destroy",
  "detail","determine","develop","dialogue","die","different","difficult","dimension","direction","directly","discipline","discover",
  "discrimination","discuss","disposal","distance","distribute","diverse","diversity","do","does","dominant","done","door",
  "doubt","down","draft","draw","dream","drive","drop","due","during","duty","each","early",
  "earth","east","easy","eat","economic","edge","education","effect","efficient","elaborate","election","eliminate",
  "emerge","emphasis","employ","encounter","end","energy","enforce","engage","enhancement","enjoy","enough","enter",
  "entire","environment","equality","equipment","error","especially","essential","establish","estimate","ethical","evaluate","evaluation",
  "even","evening","eventual","ever","every","evidence","evolution","example","except","executive","exercise","exist",
  "expand","expect","experience","expert","explain","explicit","exposure","extract","extreme","eye","face","facilitate",
  "fact","failure","fair","faith","fall","family","far","fast","father","fear","feature","february",
  "feed","feel","few","field","fight","figure","fill","finally","financial","find","fire","first",
  "flexible","floor","focus","follow","foot","for","force","foreign","forest","forget","form","formal",
  "former","found","foundation","framework","free","freedom","frequency","friday","friend","from","front","full",
  "fundamental","future","gap","garden","gate","generate","get","give","global","go","goal","gold",
  "good","government","gray","great","green","grey","ground","group","grow","growth","guide","had",
  "hand","happen","hard","have","he","head","health","hear","heart","heavy","help","here",
  "herself","hide","high","highway","hill","him","himself","his","history","hold","home","honour",
  "hospital","hot","hour","house","how","human","hypothesis","idea","identical","identify","ideology","if",
  "illustrate","impact","implement","implicit","important","improve","in","incentive","include","incorporate","increase","indeed",
  "indicate","individual","industry","inequality","influence","inform","infrastructure","inherent","innovation","inside","instead","institution",
  "integrate","intensity","interest","interpret","into","investigate","involve","involvement","is","island","issue","it",
  "its","itself","january","job","july","june","just","justice","keep","kind","know","labour",
  "lake","lane","large","last","late","later","lead","leader","leadership","learn","leave","left",
  "legal","let","level","liberal","life","light","like","likely","limitation","line","link","list",
  "little","live","local","locate","logical","long","look","low","main","make","man","manage",
  "many","march","market","matter","may","me","mean","measure","mechanism","media","meet","method",
  "middle","might","million","mind","minister","miss","modern","moment","monday","month","more","morning",
  "most","motivate","mountain","move","much","multiple","must","mutual","my","name","nation","national",
  "natural","near","need","negative","network","neutral","never","new","next","night","no","nor",
  "north","not","note","nothing","notice","november","now","number","objective","observe","obtain","ocean",
  "october","of","off","offer","often","old","on","once","ongoing","only","open","option",
  "or","orange","order","organization","other","our","out","outcome","outside","over","overall","own",
  "parameter","park","part","participation","partner","party","pass","past","path","pattern","people","perform",
  "period","person","phenomenon","philosophy","physical","pink","place","plan","play","point","police","policy",
  "popular","position","positive","possible","potential","power","practice","preliminary","prepare","present","pressure","price",
  "primary","principle","priority","private","problem","procedure","process","produce","professional","profit","project","proportion",
  "protect","prove","provide","psychological","public","purple","purpose","put","question","quickly","quite","radical",
  "raise","range","rate","rational","reach","reaction","read","real","really","reason","receive","red",
  "reduce","reform","region","regional","regulate","reject","relate","relevant","rely","remain","remember","replace",
  "report","resolution","resource","respond","responsibility","rest","restrict","result","retain","return","revenue","review",
  "right","rise","risk","river","road","role","roof","rule","run","safe","same","saturday",
  "say","school","second","section","security","see","seek","seem","send","senior","sense","september",
  "sequence","serious","service","set","she","show","side","significant","silver","similar","simulate","since",
  "single","skill","small","so","social","sociology","solution","some","something","sometimes","soon","sort",
  "source","south","speak","specialist","specific","specify","speech","spend","spring","stable","stand","start",
  "state","statement","stay","step","still","stop","story","strategic","strategy","street","strength","strong",
  "structure","study","subject","success","such","suffer","sufficient","suggest","summer","sunday","support","sure",
  "surface","survive","sustainable","system","systematic","take","talk","teacher","technology","tell","tension","term",
  "territory","than","that","the","their","them","then","theoretical","there","these","they","thing",
  "think","this","those","though","through","thursday","time","to","today","together","tomorrow","too",
  "top","total","toward","town","traditional","transfer","transition","treat","truth","try","tuesday","turn",
  "two","ultimate","under","understand","uniform","union","unique","unit","universal","until","up","use",
  "valley","variable","various","very","view","village","violence","voice","vote","walk","wall","want",
  "war","watch","water","way","we","wednesday","week","well","were","west","what","when",
  "where","whereas","whether","which","while","white","who","why","wide","widespread","will","window",
  "winter","with","within","without","woman","word","work","world","would","write","year","yellow",
  "yes","yesterday","yet","you","young","your","zone"
  ];
  var COMMON_WORDS = new Set(COMMON_WORDS_LIST);

  function isCommonWord(word) {
    if (!word) return false;
    return COMMON_WORDS.has(String(word).toLowerCase().replace(/[^a-z]/g, ""));
  }

  // Returns 0..1 : fraction of content words (>2 letters) that are NOT common.
  function getDifficultyIndex(text) {
    if (!text) return 0;
    var words = String(text)
      .toLowerCase()
      .split(/\s+/)
      .map(function (w) { return w.replace(/[^a-z]/g, ""); })
      .filter(function (w) { return w.length > 2; });
    if (words.length === 0) return 0;
    var difficult = 0;
    for (var i = 0; i < words.length; i++) if (!COMMON_WORDS.has(words[i])) difficult++;
    return difficult / words.length;
  }

  root.DysAssistWordFreq = {
    COMMON_WORDS: COMMON_WORDS,
    size: COMMON_WORDS.size,
    isCommonWord: isCommonWord,
    getDifficultyIndex: getDifficultyIndex
  };
})(typeof window !== "undefined" ? window : (typeof self !== "undefined" ? self : this));
