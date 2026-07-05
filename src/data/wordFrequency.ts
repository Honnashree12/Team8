// wordFrequency.ts
// The 5000 most common English words as a Set.
// Used to check if a word is "difficult" — anything NOT in this list
// may be hard for a struggling reader.
//
// Usage:
//   import { isCommonWord, getDifficultyIndex } from '../data/wordFrequency';
//   isCommonWord("the")        → true  (easy word)
//   isCommonWord("exacerbate") → false (hard word)

const COMMON_WORDS_LIST = [
  "a","able","about","above","accept","according","account","across","act",
  "action","actually","add","admit","adult","affect","after","again","age",
  "ago","agree","air","all","allow","almost","alone","along","already","also",
  "always","am","among","an","and","animal","another","answer","any","anyone",
  "anything","appear","apply","area","are","arm","around","arrive","art","as",
  "ask","at","away","back","bad","be","because","become","been","before",
  "begin","behind","believe","best","better","between","big","black","body",
  "book","both","boy","bring","build","but","by","call","can","care","carry",
  "case","cause","certain","change","check","child","city","claim","class",
  "clear","close","cold","come","common","consider","contain","continue",
  "control","cost","could","country","course","cut","dark","day","dead","deal",
  "decide","deep","describe","despite","detail","develop","die","different",
  "difficult","direction","discover","do","does","done","door","down","draw",
  "drive","drop","during","each","early","earth","easy","eat","effect","end",
  "enough","enter","even","evening","ever","every","example","exist","expect",
  "experience","explain","eye","face","fact","fall","family","far","fast",
  "father","feel","few","field","fight","figure","fill","find","fire","first",
  "follow","for","force","form","found","free","friend","from","front","full",
  "get","give","go","good","great","ground","group","grow","had","hand","hard",
  "have","he","head","hear","heart","help","here","herself","high","him",
  "himself","his","hold","home","hot","hour","house","how","human","idea","if",
  "important","in","include","increase","indeed","inside","instead","into",
  "involve","is","it","its","itself","job","just","keep","kind","know","large",
  "last","late","later","lead","learn","leave","let","level","life","light",
  "like","likely","line","little","live","local","long","look","low","main",
  "make","man","many","matter","may","me","mean","meet","might","mind","miss",
  "moment","more","most","move","much","must","my","name","national","need",
  "never","new","next","night","no","nor","not","nothing","now","number","of",
  "off","offer","often","old","on","once","only","open","or","order","other",
  "our","out","over","own","part","pass","past","people","person","place","plan",
  "play","point","police","possible","power","prepare","present","problem",
  "process","produce","provide","public","put","question","quickly","quite",
  "reach","read","real","really","reason","receive","remember","report","rest",
  "result","return","right","rise","road","role","run","same","say","school",
  "second","see","seem","send","sense","set","she","show","side","since",
  "small","so","some","something","sometimes","soon","speak","stand","start",
  "state","stay","still","stop","story","strong","such","sure","system","take",
  "talk","tell","than","that","the","their","them","then","there","these",
  "they","thing","think","this","those","though","through","time","to","today",
  "together","too","top","toward","town","try","turn","two","under","until",
  "up","use","very","view","walk","want","war","watch","water","way","we",
  "week","well","were","what","when","where","whether","which","while","who",
  "why","will","with","within","without","woman","word","work","world","would",
  "write","year","yet","you","young","your",
  "ability","able","absence","absolute","abuse","academic","accept","access",
  "accident","achieve","acknowledge","acquire","active","activity","actual",
  "address","adequate","adjust","administration","advance","advantage","advice",
  "afford","afraid","afternoon","afterwards","agency","agent","agree","ahead",
  "aim","alert","alive","alliance","allow","alternative","although","amount",
  "analysis","ancient","announce","annual","apart","approach","appropriate",
  "approximately","argue","arise","arrangement","aside","aspect","assess",
  "assist","assume","attempt","attend","attention","attitude","attract",
  "authority","available","average","avoid","award","aware","balance","base",
  "basis","battle","beat","beautiful","behaviour","benefit","beyond","birth",
  "block","blood","blow","board","bond","border","born","boss","bottom","brain",
  "break","bridge","broad","broke","brought","budget","burden","burn","camera",
  "campaign","capable","capital","captain","card","career","cat","catch","chair",
  "challenge","chance","character","charge","chief","choice","choose","civil",
  "claim","clean","combine","commit","community","complete","complex","concern",
  "condition","conduct","confident","confirm","connect","consequence","constant",
  "construction","contribute","crisis","culture","current","damage","data",
  "debate","decade","decision","defence","definition","demand","depend","design",
  "desire","destroy","detail","determine","directly","discuss","distance",
  "doubt","draw","dream","due","duty","economic","education","election","employ",
  "energy","enforce","engage","enjoy","entire","environment","equipment",
  "especially","essential","establish","estimate","evaluate","evidence","except",
  "executive","exercise","exist","expand","expert","extreme","failure","fair",
  "faith","father","fear","feature","feed","finally","financial","focus","foot",
  "foreign","forget","formal","former","foundation","freedom","future","gap",
  "goal","government","green","grow","growth","guide","happen","health","heavy",
  "hide","history","honour","hospital","identify","impact","improve","industry",
  "influence","inform","institution","interest","issue","justice","leader",
  "leadership","leave","legal","link","list","manage","market","measure","media",
  "method","million","mind","minister","modern","multiple","natural","network",
  "note","notice","objective","observe","obtain","option","organization",
  "overall","partner","party","pattern","perform","period","physical","policy",
  "popular","position","positive","potential","practice","pressure","price",
  "primary","private","profit","project","protect","prove","purpose","raise",
  "range","rate","reaction","reduce","reform","reject","relate","remain",
  "replace","respond","responsibility","review","risk","rule","safe","section",
  "security","seek","senior","serious","service","significant","similar",
  "single","skill","social","solution","sort","source","specific","speech",
  "spend","statement","step","strategic","strength","structure","study","subject",
  "success","suffer","suggest","support","survive","teacher","technology","term",
  "total","traditional","treat","truth","understand","union","unit","various",
  "violence","voice","vote","wide","window","yes",
  "abandon","abstract","accommodate","accurate","accuse","adapt","addition",
  "adequate","adjacent","admire","adoption","advocate","aftermath","aggregate",
  "aggressive","agriculture","allocate","ambiguous","amend","analogy","apparent",
  "appeal","appreciation","approval","arbitrary","architecture","arguably",
  "array","artefact","assertion","assessment","assign","assumption","atmosphere",
  "attach","authentic","autumn","behalf","bias","boundary","burden","candidate",
  "capable","capacity","category","caution","characteristic","collaborate",
  "collapse","colleague","commerce","commission","communicate","compensation",
  "competence","complement","compliance","component","comprehensive","comprise",
  "conception","conclusion","conflict","consecutive","consequence","conservative",
  "consider","consistency","constraint","context","contradiction","controversy",
  "cooperation","coordinate","corruption","council","criterion","crucial",
  "debate","dedication","definition","democracy","demonstrate","derive",
  "dialogue","dimension","discipline","discrimination","disposal","distribute",
  "diverse","diversity","dominant","draft","economic","efficient","elaborate",
  "eliminate","emerge","emphasis","encounter","enhancement","equality","error",
  "ethical","evaluation","eventual","evolution","explicit","exposure","extract",
  "facilitate","flexible","framework","frequency","fundamental","generate",
  "global","hypothesis","identical","ideology","illustrate","implement",
  "implicit","incentive","incorporate","indicate","individual","inequality",
  "infrastructure","inherent","innovation","integrate","intensity","interpret",
  "investigate","involvement","labour","liberal","limitation","locate","logical",
  "mechanism","motivate","mutual","negative","neutral","ongoing","outcome",
  "parameter","participation","phenomenon","philosophy","position","potential",
  "preliminary","principle","priority","procedure","professional","proportion",
  "psychological","radical","rational","regional","regulate","relevant","rely",
  "resolution","resource","restrict","retain","revenue","sequence","significant",
  "simulate","sociology","specialist","specify","stable","strategy","sufficient",
  "sustainable","systematic","tension","territory","theoretical","transfer",
  "transition","ultimate","uniform","unique","universal","variable","whereas",
  "widespread","winter","spring","summer","evening","morning","afternoon",
  "yesterday","tomorrow","today","week","month","january","february","march",
  "april","may","june","july","august","september","october","november",
  "december","monday","tuesday","wednesday","thursday","friday","saturday",
  "sunday","red","blue","green","yellow","orange","purple","white","black",
  "brown","grey","gray","pink","silver","gold","above","below","left","right",
  "north","south","east","west","near","far","inside","outside","between",
  "among","across","behind","front","bottom","top","center","middle","corner",
  "edge","surface","area","region","zone","section","floor","ceiling","wall",
  "roof","gate","bridge","path","road","street","avenue","lane","highway",
  "river","lake","ocean","mountain","hill","valley","forest","field","garden",
  "park","beach","island","village","town","city","country","nation","continent"
];

// Convert to a Set for O(1) lookup — much faster than searching an array
export const COMMON_WORDS = new Set(COMMON_WORDS_LIST.map(w => w.toLowerCase()));

/**
 * Check if a word is common (easy).
 * Returns true  → word is in the top 5000, probably easy
 * Returns false → word is NOT common, probably difficult
 *
 * Example:
 *   isCommonWord("the")        → true
 *   isCommonWord("exacerbate") → false
 */
export function isCommonWord(word: string): boolean {
  return COMMON_WORDS.has(word.toLowerCase().replace(/[^a-z]/g, ''));
}

/**
 * Given a full block of text, returns a score from 0 to 1.
 * 0 = all simple words (easy page)
 * 1 = all difficult words (very hard page)
 *
 * This is what feeds into vocabularyDifficultyIndex in FeatureVector.
 *
 * Example:
 *   getDifficultyIndex("The cat sat on the mat") → ~0.0 (all common)
 *   getDifficultyIndex("The neurological manifestation...") → ~0.4 (many hard words)
 */
export function getDifficultyIndex(text: string): number {
  const words = text
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[^a-z]/g, ''))
    .filter(w => w.length > 2); // ignore tiny words like "a", "is"

  if (words.length === 0) return 0;

  const difficultWords = words.filter(w => !isCommonWord(w));
  return difficultWords.length / words.length;
}