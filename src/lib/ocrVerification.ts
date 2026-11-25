import {
  cleanAsciiUpper,
  cleanCp1250Bydliste,
  cleanCp1250Name,
  normalizeCountryCode,
  parseCzechAddress
} from './ubyport';

export type NameCheckStatus = 'verified' | 'suspect' | 'unverified';

export interface NameTokenCheckResult {
  status: NameCheckStatus;
  message: string;
  suggestion?: string;
  matchedVia?: 'dictionary' | 'gemini' | 'fuzzy' | 'heuristic';
}

export interface GuestNameVerification {
  firstName: NameTokenCheckResult;
  lastName: NameTokenCheckResult;
  hasWarning: boolean;
}

export interface GeminiNameCheckHint {
  firstNameValid?: boolean;
  lastNameValid?: boolean;
  suggestedFirstName?: string;
  suggestedLastName?: string;
  reason?: string;
}

export type AddressCheckStatus = 'idle' | 'checking' | 'verified' | 'partial' | 'suspect' | 'error';

export interface AddressVerificationResult {
  status: AddressCheckStatus;
  message: string;
  normalizedStreet?: string;
  normalizedCity?: string;
  normalizedPostalCode?: string;
  normalizedDistrict?: string;
  normalizedMunicipality?: string;
  normalizedCityPart?: string;
  normalizedCountry?: string;
  displayName?: string;
}

// Kompaktní mezinárodní slovník nejčastějších křestních jmen (bez diakritiky pro rychlé porovnání i fuzzy kontrolu)
const FIRST_NAME_WORDS = `
adam adela adolf adrian adriana agata agnes aaron abigail ahmed aiden alain alan albert aleksander aleksandra
alena ales alex alexander alexandra alexei alexis alfred alice alicia alina alisa alison allan allen alma alois
amanda amber amelia amy ana anastasia anders andre andrea andreas andrei andres andrew andrzej aneta angela
angelica angelina angelo anita anja anna anne annika anthony antoine anton antonella antonia antonin antonio
anya arthur artur ashley astrid aubrey audrey augustin aurelia austin ava axel ayako
barbara barbora barry bartosz beatrice beatrix becky bella ben benjamin benno bernard bernhard bert berta
bethany bettina bianca biljana bill birgit bjorn blake blazena bob bobby bohumil bohuslav boris bradley brandon
brenda brian bridget brigitte brittany bruno bryan bryce
camila camille carina carl carla carlo carlos carmen carol caroline carsten catherine cecilia cedric celine
charles charlotte chelsea chloe chris christian christiane christina christine christoph christopher cindy
claire clara claudia claus clement clifford clint colin connie connor constanze cora cornelia craig cristian
cristina crystal curtis cynthia cyril czech
dagmar dale damian dan dana daniel daniela danielle danny daria dariusz darren dave david dawid dean deborah
denis denisa denise dennis derek diana diane diego dieter dirk dominic dominik dominika donald donna doris
dorota dorothea doug douglas drew dusan dylan
edgar edita edith edmund eduard edward edwin egon eileen elena eli elias elena elisabeth elise eliza
elizabeth ella ellen elliot ellis eloise elsa elvira emil emilia emilie emily emma emmanuel enrico eric erich
erik erika erin ernst esther ethan eugene eva evelyn ewa
fabian fabio fiona felix ferdinand filip fiona florence florian frances francesca francis francisco francois
frank franziska fred frederik frieda friedrich frantisek
gabriel gabriela gabrielle gael gareth gary gavin george georg georges georgia gerald gerard gerda gerhard
germaine gert gertrude gianluca gianna gideon gilles gina giovanni gisela giulia gladys glen glenn gloria
gordon grace graham grant greg gregory greta gretchen guido guillaume gunnar gunter gunther gustav guy
hana hanna hannah hans harald harold harriet harry hartmut hazel heather heidi heike heinrich heinz helen
helena helene helga helmut hendrik henri henrik henriette henry herbert herman hermann hilda holly horst
howard hubert hugo hunter hynek
ian ibrahim ida igor ilona imre ina ines inga inge ingrid irena irene irina iris irma isaac isabel
isabella isabelle ivan ivana iveta ivo
jack jackie jacob jacqueline jacques jade jake jakub james jamie jan jana jane janet janice janina jannis
jarek jaromir jaroslav jaroslaw jasmin jasmine jason jasper javier jay jean jeanette jeanne jeff jeffrey
jelena jena jenifer jenna jennifer jens jeremy jerome jerry jess jesse jessica jesus jill jim jimmy jindrich
jiri joachim joan joanna joanne joao jochen joe joel joey johan johann johanna johannes john johnny jon
jonas jonathan jordan jorge jose josef joseph josephine joshua josie jozef juan judit judith julia julian
juliana juliane julie julien julius june juraj jurgen justin justina justyna
kacper kai kamil kamila kara karen karin karina karl karla karol karolina karsten kaspar kasper katarina
katarzyna kate katharina kathrin katherine kathleen kathryn katie katja katrin katrina kay kayla keith
kelly ken kendra kenneth kent kerry kevin khaled kian kieran kim kimberly kira kirsten klara klaus klement
karel kristian kristina kristyna krzysztof kurt kyle
ladislav laura lauren laurent laurie lawrence lea leah leila lena lenka leo leon leonard leonardo leonie
leopold leslie leszek letizia levi liam liana lida lidia lillian lily lina linda lindsay lisa lorenzo lori
lothar louis louise luc luca lucas lucia lucie lucien lucy ludmila ludvik luis luisa lukas lukasz luke
lutz lydia lynn
maciej madeleine madeline madison magda magdalena maik maike maja malcolm malgorzata malik manfred manuel
manuela marc marcel marcela marcelo marco marcus marek margaret margarete margit margot maria marian mariana
marianne marie marija marika marilyn marina mario marion marissa marius mariusz mark marketa marko markus
marlene marlon martha martin martina marvin mary marysia mason matej mateusz matthias matthew matthieu
maureen maurice max maxim maximilian maxine maya megan melanie melissa meredith michael michaela michal
michel michele michelle mick miguel mikael mikhail mikolas mikulas mila milan milena milos miloslav miriam
mirka miroslav miriam mitchell mohammad mohammed molly mona monica monika morgan moritz morten moses muriel
myriam
nadezda nadia nadine nadja nancy naomi natalia natalie natalya natasha nathan nathaniel neil nelly nelson
nicholas nick nicky nicola nicolas nicole niels nigel nikita niklas nikola nikolai nikolas nils nina noah
noel noemi nora norbert norma norman
olaf oldrich oleg olga oliver olivia omar ondrej oskar oswald otakar oto otto owen
pablo paige pamela paola paolo patricia patrick patrik paul paula pauline paulo pavel pavla pavol pawel
pedro peggy penny per peter petr petra petra phil philip philipp philippe phillip phoebe pierre piotr
polina priscilla
quentin quinn
rachel radek radim radka radovan rafael rafal rainer ralf ralph ramon ramona randall randy raphael
raquel ray raymond rebecca rebeka regina reinhold reinhard remi rene renata renate renee ricardo richard
rick ricky rita rob robert roberta roberto robin rodney roger roland rolf roman romana romeo ronald
ronnie rosa rosalie rose rosemary rosita ross rostislav roy ruben rudolf rupert russell ruth ryan
sabina sabine sabrina sacha sally sam samantha samuel sandra sandy sara sarah sarka sascha sasha saul
scott sean sebastian selena selina serge sergei sergio seth shane shannon sharon shaun shawn sheila
shelley sheri sherry shirley sibylle sidney siegfried sigrid silke silvia silvie simon simona simone
sofia sofie sonia sonja sophia sophie stacey stanislav stanislaw stanley stefan stefanie stella stephan
stephanie stephen steve steven stewart stuart sue susan susanne sven svenja svetlana sylvia sylvie szymon
tabitha tamara tania tanja tanya tara tatiana taylor ted teddy teresa tereza terry tessa theo theodor
theodore theresa therese thomas thorsten tiffany tim timothy tina tobias toby tom tomas tomasz tommy
toni tony tracey tracy travis trevor tricia tristan troy tyler
udo ulrich ulrike uma ursula uwe
vaclav valentin valentina valerie valery vanessa vera verena veronica veronika victor victoria viktor
viktoria vilma vincent viola violet virginia vit vitezslav vivian vladimir vladislav vojtech volker
walter wanda warren wayne wendy werner wesley whitney wilfried wilhelm will william willie willy wilma
wladyslaw wolfgang wojciech wyatt
xaver xavier
yannick yasmin yoko yolanda yuki yuri yvonne
zach zachary zakaria zdenek zdenka zoe zofia zora zosia zuzana zuzanna
`
  .trim()
  .split(/\s+/);

// Kompaktní mezinárodní slovník nejčastějších příjmení
const SURNAME_WORDS = `
abraham adams adam adamczyk adamek adamski adler agnew ahmed albers albert albrecht alexander allen allison
almeida alonso alvarez amann andersen anderson andre andreas andreev andrews angelov anthony antonio
arnold arndt arnoldi arthur ashworth atkins atkinson austin
bach bacher bachmann backer bailey baker bakker baldwin ball ballard barber barclay barker barnes barnett
barrett barry bartels barth bartlett barton bartos bartosz bauer baumann baumgartner baxter bayer beach
becker beckers beckett beckmann bednar bednarz beer behrens bell bender benes bennett benoit benson bentley
berger bergmann bergerova bernard berndt bernhard berry bertrand best becker bialek bianchi bielecki
bielik bily bishop black blackburn blaha blair blake blanchard blanco blank blazek bloch block bloom
blum blume bobek bock bode boehm bogdan bohm bohme bohn bolton bond bonner bonnet boone booth borowski
bosch bose bosse bouchard boucher boulanger bourne bowen bower bowers bowman boyd boyle bradley brady
brand brandt braun bray brennan brenner brewer briggs bright brock brooks brown browne bruce bruckner
bruggemann brunner bruns bryan bryant buchanan bucher buchholz buck buckley budny budzinski buehler
buhler bullock burch burke burnett burns burton busch bush butler byrne
cabrera cain calderon caldwell callahan cameron campbell campos cano cantrell cardenas carey carlson
carney carpenter carr carrasco carroll carson carter carvalho casey castaneda castillo castro catalan
cavanagh cerny cervantes cesar chadwick chambers chan chandler chang chapman charles chase chavez chen
cheng cherry chevalier chiang choi christensen christian christiansen christophersen chung churchill clark
clarke clayton clement clements cleveland clifton cline clinton clyde cobb cochran cohen cole coleman
collier collins colon compton conley connell connelly conner connolly connor conrad conway cook cooke
cooley cooper copeland corbett corcoran cordoba cornell corona cortes cortez costa costello cote cotton
couch coughlin coulter courtney cousins cowan cox coyle crabtree craig cramer crane crawford creech
crisp croft crosby cross crow crowley cruz cullen cummings cummins cunningham curran curry curtis
czaja czarnecki czech czerwonka
dabrowski dahl dalton daly damm daniel daniels daniluk davis dawson day dean decker degenhardt dekker
delgado delorme demers dennis denton derrick desai deschamps dettmer deutsch devine devlin devries diaz
dick dickens dickinson dickson diehl dieter dietrich dietz dillon dixon doan dobosz dobry dobson dodd
dodge doherty dolan dolezel domagala dominguez donahue donald donaldson donnelly donovan doran dorner
dorsey douglas dowd dowdy dowling downs doyle drake draper drew driscoll driver drozdowski duarte dubois
duda dudek dudley duffy duggan duke dumas duncan dunham dunlap dunn dunne dupont dupuis duran durand
durant durham dutton duval dvorak dvorakova dwyer dyer
eaton eberhardt ebert eckert eddy edelmann edwards egan egger eggers ehrmann eichhorn eichler eisenberg
eisenhower elder eldridge elias eliot eliott elliott ellis ellison ellsworth elmer emerson emery emrich
engel engelhardt engelman engelmann england engle english enriquez epstein erdmann erickson eriksson
ernst erwin escobar espinoza esposito estes estrada evans everett ewing
faber fabian fagan falk fallon farrell farley farmer farr farrell faulkner faust fawcett fay fischer
fiala fiedler field fields figueroa filip filipiak finch findlay fink finkelstein finley finn fischer
fish fisher fitch fitzgerald fitzpatrick fitzsimmons flaherty flanagan fleming fletcher flint flores
flowers floyd flynn foley fong fontaine foo foote forbes ford foreman forest forster forsyth fortier
foster fountain fournier fowler fox francis franco francois frank franke franklin franks franz fraser
frazier frederick frederiksen freeman french frey frick friedman friedrich friend fries fritsch fritz
froehlich frost fry frye fuchs fuentes fuller fulton funk furman
gabor gabriel gaffney gagne gagnon gaines galbraith gale gallagher gallardo gallego gallo galloway
galvan gamble gannon garcia gardner garland garner garrett garrison garza gates gauthier gay geiger
geisler george gerber gerdes gerhard gerhardt gerlach german gerrard geyer gibbons gibbs gibson
giese gil gilbert giles gill gillen gillespie gilliam gillis gilmore ginther giordano girard glaser
glass glazer gleason glenn glover gnewuch gobel godfrey godwin goebel goertz goetz goff gold goldberg
golden goldman goldstein gomez gonzales gonzalez good goode goodman goodwin gordon gore gorman gorski
goss gottschalk gough gould grabowski grace grady graf graham granger grant graves gray grayson green
greene greenberg greer gregor gregory greiner griebel griffin griffith griffiths griggs grimm grimes
grimm gros gross grosse grosser grossman grossmann grove grover gruber gruen gruener grundmann guerin
guerra guerrero guevara guida guillaume guillory gunn gunter gunther gustafson gutierrez guy guzman
haag haas haase haber habermann hacker hadley haehn haertel hafele hagen hager hahn haight haines
hajek haley hall haller halliday halvorsen ham hamilton hamm hammer hammond hampton han hancock
hand handle handler haney hanka hanke hankins hanks hanley hanlon hanna hannah hannen hannigan hansen
hanson harbison harden hardin harding hardy hargrove harkins harlan harley harlow harmon harper
harrell harrington harris harrison hart hartman hartmann hartung hartwig harvey hasan hass hassan
hatfield hathaway hauer haupt hauser hausmann haven havens hawkins hawley hawthorne hay hayden hayes
haynes hays hayward hazen head healy heard hearn heath heaton hebert heck hecker hediger hedrick
heffernan hegarty heide heidel heidenreich heider heil heilmann heim heiman heimann hein heine
heineman heinemann heinrich heinrichs heintz heinz heinze heise heiser heitmann held helfer heller
hellmann helm helms helton hemingway hemmel hempel henderson hendricks hendrickson hendrix henke
henkel henley henne henning henry hensley henson herbert herbst herman hermann hernandez herold
herrera herring herrmann hershberger hershey hertwig hertz herz herzog hess hesse hetzel heuer
hewitt hey heymann heywood hibbard hickey hickman hicks higgins higgs high highland hightower hildebrand
hildebrandt hill hillenbrand hiller hillman hills hilton himmel hinckley hinds hines hinkle hinrichs
hinton hinz hirsch hirschfeld hitchcock hite hladik hlavac hoag hoagland hobbs hobson hoch hock
hocker hodge hodges hodgson hoff hoffman hoffmann hofmann hogan hogg holbrook holcomb holden holder
holland hollander hollenbeck holley holliday hollinger hollingsworth hollis holloway holm holman
holmes holmquist holst holt holton holtz holz holzer holzmann homan homer honig hood hook hooks
hooper hoover hope hopkins hopper hopwood horacek horak horan horn horne horner hornsby horowitz
horst horstmann horton horvat horvath hoskins hostetler hotchkiss houck hough houghton house houser
houston houten hovey howard howe howell howes howland hoy hoyt hrbek hruba hruby hruska huang
hubbard huber hubert hubner huck huddleston hudson huebner huerta huff huffman hughes hugo hull
hulsey hummel humphrey humphreys hundley hunt hunter huntington huntley hurd hurley hurst hurt
hussein hussey huston hutchings hutchins hutchinson hutton hyde hyland hyman
ibarra ibrahim iglesias ilic ingram inman ireland irizarry irvin irvine irving irwin isaac isaacs
isaacson isbell isenberg ismail isom israel itoh ivanov ivanova iverson ives
jablonski jack jackman jacks jackson jacob jacobi jacobs jacobsen jacobson jacques jaeger jaffe
jahn jahns jakob jakobsen jakubec jakubowski james jameson jamieson jamison janacek janak janda
janik janke jankowski janos janous jansen janson janssen jantzen janus janz jaros jarosz jarrett
jarvis jasinski jasper javier jefferson jeffery jeffries jelinek jenkins jenks jennings jensen
jentsch jerger jernigan jerome jeske jessen jester jewell jimenez jirak jirik jirka jirovec job
jochim joel johannes johannsen johansen johanson john johns johnson johnston jonas jonasson jones
jonsson jordan jorgensen jose joseph joshua joslin joubert joy joyce juarez judd judge judkins
juhasz julian jung junger junker jurczyk jurek jurka just justice
kaczmarczyk kaczmarek kaczor kadlec kafka kahn kaiser kalb kalinowski kalish kallio kaltenbach
kaminski kammer kammerer kamp kane kang kann kant kaplan kapp kappel kappen karcher karl karlsen
karlsson karpinski kaspar kasper kasten kastner katz kaufman kaufmann kaul kaur kavanagh kay kaye
keane kearney kearns keating keaton keck keefe keefer keegan keel keeler keeling keen keenan keene
keeton keffer kehoe keil keim keiser keith kell keller kellerman kellermann kelley kellner kellogg
kells kelly kelsey kemp kemper kempf kendall kendrick kenedy kennedy kenner kenney kennon kenny
kent kenyon keough keppler kerber kerns kerr kerry kessler kester ketcham ketchum kevin key keys
khoury kidd kidwell kiefer kieffer kiel kiesling kiessling kilgore killian kilpatrick kim kimball
kimble kimmel kincaid kindler king kingery kingsley kinkaid kinney kinsey kinsley kirby kirch
kirchner kirk kirkland kirkpatrick kirsch kirschner kiser kiss kister kitchen kittel kittleson
klasen klaus kleber klein kleine kleiner kleinert kleinhans kleinmann kleinschmidt klement klemm
klempner klimek klimova kline kling klingenberg klinger klingle klingler klink klose klotz klug
kluge klumpp klusmann knaack knapik knapp knauf knaus knecht knezevic knickerbocker knight knights
knispel knobloch knoll knopf knorr knott knowles knowlton knox knudsen knudson knutson kobayashi
kober kobler koch kochen koci kocian kock koechlin koehler koehn koenig koenigsberg koepke koeppe
koerner koessler kohl kohler kohlman kohlmann kohn kolar kolarik kolb kolbe koller kolodziej
komarek komorowski konig konigsberg koning konopka konrad konradt koontz kopec kopecky kopf koplar
koppel koppen kopper kops korb kordas koren korhonen korn korner kornfeld korpela korsak kort
korte korten korth kos kosak kosar kosik kosinski koski koslowski kosmala kost kostka kostner
kotek koterba kotlar kotowski kott kotz kouba koubek koukal kouril koutny kovac kovacic kovacs
kowal kowalczyk kowalewski kowalik kowalski kowalsky kozak kozel koziel kozlov kozlowski krabbe
kraemer kraft krahl krainz krajci krajewski krakow kral kralik kralj kramar kramer krammer kramp
kranz krasinski kratky kratz kraus krause krauss krawczyk krebs kreis kreisel krejci krell kremen
kremers krenz krepela kresge kress kretschmer kretschmar kreutzer kreuz kreuzer krieg krieger
kriegel krier krill kristensen kristiansen kristof kroeger krogh krohn krol kroll kromer kron
krone kronenberger krueger krug kruger kruk krull krumm krump krupka krupp krus kruse kruszewski
kryger krystek krzeminski krzysztof krzywda ksiazek kubacki kubala kubat kubec kubecka kubiak
kubica kubicek kubik kubis kubista kubo kucera kuch kuchar kucharczyk kucharz kuchenbecker
kuchler kuck kuczera kudela kudla kudrna kuehl kuehn kuehne kuehnel kuehnert kuenzel kuenzli
kuettel kugel kugler kuhl kuhlmann kuhn kuhne kuhnel kuhnert kuhns kuipers kujawa kukla kulak
kulik kulinski kull kullmann kulpa kumagai kumer kummel kummer kump kumpe kundig kung kunz
kunze kunzel kunzler kuperman kupfer kupka kupper kurczewski kurek kurka kurth kurtz kurz kurze
kushner kuster kusters kutcher kutscher kutz kuwait kuzma kuzmin kuznetsov kvapil kveton kyle
kyriakou kysela
labbe labelle labonte lacasse lacey lach lachance lachmann lackey lacombe lacroix lacy ladd ladner
lafferty lafleur lafond lafontaine lagasse lager lai laidlaw lain laing laird lake lakey lalonde
lam lamar lamb lambert lamberti lamboy lambrecht lammers lamont lamoureux lamp lampe lampert
lamprecht lancaster lance land landau lander landers landes landgraf landis landon landry landsman
lane lang lange langel langen langer langevin langford langhammer langlais langley langlois
langston langton lankford lanning lannon lantz lanz lapierre laplante lapointe laporte lapp lara
large larkin laroche larocque larose larsen larson larsson larue lasalle lash lashley laska laski
laskowski lassiter lassmann latham lathrop latimer latour latteier lattimore lau laub laube lauber
lauch lauer lauf laufer laughlin lauren laurence laurent laurie laursen lauterbach laux lavalley
lavelle lavender lavigne lavoie law lawler lawless lawrence laws lawson lawton lawyer lay layne
layton lazar lazaro lazarus le lea leach leader leaf leahy leal lear leary leavitt lebeau
lebel leblanc leboeuf lebrun leclerc leclair lecompte lecuyer ledbetter leder lederer lederman
ledger leduc lee leech leeds lefevre leffler legault leger legg leggett legrand lehman lehmann
lehmkuhl lehner lehnert lehr leib leibold leibowitz leicester leicht leigh leighton lein leiner
leininger leipold leis leiser leist leister leitch leiter leith leitner leland leleux lemaire
lemaitre leman lemann lemay lemieux lemke lemm lemmel lemmer lemoine lemon lemons lemos lenahan
lenart lencioni lengyel lenihan lenk lennon lennox lent lentz lenz leo leon leonard leone leong
leonhardt leopold lepage lepine lepper lerch lerma lerner leroux leroy lesage leser lesher leslie
lessard lesser lessing lester letourneau letson lett letterman leu leung leuschner leuthold lev
levant levasseur leveille levelle leven leventhal leveque leverett levering levey levi levin
levine levinson levis levitt levy lewandowski lewinski lewis ley leyden leyer li liang libby
liberman licht lichtenberg lichtenstein lichter liddell lidel liddle lieb lieber lieberman
liebermann liebert liebig liebl liebler lieblich liebmann liebscher liedtke lien lienhard lienhardt
lies lieske liggett light lightfoot lighthouse lightner likely lilley lillie lilly lim lima
limbach limbaugh limeback limmer lin lincoln lind lindauer lindberg lindemann linden lindenberg
linder linderman lindermann lindgren lindholm lindley lindner lindqvist lindsay lindsey lindstrom
linehan lines ling lingenfelter lingle link linke linker linkous linn linnemann lins linscott
lint linton lintz linville linz lipinski lipka lipman lipp lippert lippincott lippman lippmann
lipscomb lipski lipton lira lis lisowski list lister liston litchfield liter lithgow littell little
littlefield littlejohn littleton littrell liu livermore livesay livingston livingstone lizardi
lloyd lo loach loader lobato lobo loch locher lock locke locker lockhart locklear lockwood
lodge loeb loeffler loehr loera loesch loew loewen loewenstein loewy lofland loftin loftis lofton
loftus logan loggins logsdon logue loh lohman lohmann lohmeyer lohr lollar lomax lombard lombardi
lombardo london long longer longfellow longino longley longo longoria longstreet longsworth
longwell longworth lonn lookabill loomis looney loop loos loose loper lopes lopez loranger lord
lore lorenz lorenzen lorenzo lorigan loring losch loser lott lotz lou loucks loud louden louder
louie louis loundes loup love lovelace loveland loveless lovell lovely lovering lovesey lovett
lovelace low lowe lowell lowen lowenstein lower lowery lowman lowrey lowry loy loya loyd lozano
lu lubbers lubin lubinski luby lucas luce lucero lucia luciano luck lucke luckenbach luckett
luckey lucas ludden ludeking luden luder ludlam ludlow ludwig luebke lueck lueders luedke luehrs
luellen lueth luevano luft lugo luhmann luhn luis lukas lukasik luke lukens lukes lukowski luley
lull lum lumpkin lumsden luna lund lundberg lunde lundgren lundin lundquist lundstrom lundy lung
lunn lunsford lunt lupo lupton lurie lusk luster lustig luter luther luttrell lutz lutze lux
ly lyall lydick lydon lyle lyles lyman lynch lynde lyndon lynn lyon lyons lysaght lytle
maas maass mabe maben mabry mac macdonald mace macfarlane macgregor mach macha machacek machado
macher machnik macias maciejewski macintyre mack mackay mackenzie mackey mackie mackin mackintosh
macklin maclean macleod macmillan macneil macpherson macrae madden maddox mader madigan madison
madrid madrigal madsen maes maestas maeurer magana magee maggard maggio magid magill maginnis
magnan magner magnus magnuson magnussen mahaffey mahan maher mahler mahon mahoney mahony mahr
mai maier maillet main maine maines mains mainz mair maisel maurer majer majeski majewski major
majors makinen makowski makris malachowski malarkey maldonado malek maley malik malin malina
malinowski malkin mallard mallett malley mallon mallory malloy malm malmberg malmquist malone
maloney maloy malpass maltby mammen manahan manchester mancini mancuso mandel mandell manders
mandeville mandl maness maney manfredi mangan mangano manges mangold mangrum mangum manion
maniscalco mankin manley mann manning mannion manns mano manriquez mansell mansfield manson
mansour mantel mantell mantey mantooth manuel manville manz manzano mapes maple maples mapp
mara marable marble marbury marc march marchand marchant marchese marchetti marconi marcotte
marcoux marcum marcus marcy marek marek marentette mares maresh margaret margolis mariani mariano
marino marion mark markel markell marker markert markett markey markham markle markley markov
markovic markowitz marks markus markwell marlatt marler marley marlow marlowe marmolejo maron
maroney marotta marple marquardt marquette marquez marquis marr marrero marriott marrow marrs
mars marsden marsh marshall marsicano marston martel martell marten martens martha marti martin
martineau martinek martinez martini martino martins martinsen martinson martz marvel marvin marx
mary mas masa maschke mascio maser mash mashburn mask maske mason mass massa masse massengale
massengill masser massey massie massingale massman masson mast masten master masters masterson
mastin masterson mata matheson mathews mathewson mathias mathies mathieson mathieu mathis mathisen
matias matlock matos matous matousek matson matsuda matsumoto matsuoka matt matte mattei matters
mattern mattes matteson matthes matthews matthias matthies matthiessen mattingly mattis mattison
mattson matula matulik matus matusiak matusik matuska matuszewski matz matzner mau mauck mauer
maul mauldin maupin maurer maurice maury maus mauser mautz maw mawhinney maxey maxfield maxson
maxwell may mayberry maye mayer mayers mayes mayfield mayhew mayle maynard mayo mayor mayorga
mays mazur mazurek mazza mazzola mcadoo mcalister mcallister mcanally mcandrew mcanulty mcarthur
mcaslin mcateer mcauliffe mcavoy mcbain mcbee mcbeth mcbride mcbroom mcburney mccabe mccafferty
mccaffrey mccain mccall mccalla mccallister mccallum mccammon mccandless mccann mccants mccardle
mccarley mccarroll mccarter mccarthy mccartney mccarty mccaskill mccaslin mccaul mccauley
mccausland mccay mcclain mcclanahan mcclary mcclay mccleary mcclellan mcclelland mcclendon
mcclintock mcclish mccloskey mccloud mcclung mcclure mcclurg mccluskey mccollum mccomb mccombs
mcconkey mcconnell mcconville mccool mccord mccorkle mccormack mccormick mccormack mccown mccoy
mccracken mccrae mccrary mccraw mccray mccrea mccready mccreary mccreery mccright mccrimmon
mccrystal mccubbin mccue mcculloch mccullough mccully mccune mccurdy mccurry mccutchen mccutcheon
mcdaniel mcdaniels mcdermott mcdevitt mcdilda mcdill mcdonald mcdonell mcdonnell mcdonough
mcdougal mcdougall mcdowell mcdonald mceachern mcelhaney mcelrath mcelroy mcelvain mcelveen
mcelwee mceneaney mcentee mcentire mceuen mcevoy mcewen mcfadden mcfadyen mcfall mcfarland mcfarlane
mcfarlin mcfarren mcfatter mcferrin mcgaha mcgahay mcgann mcgarrity mcgarry mcgarvey mcgaugh
mcgaughey mcgavin mcgaw mcgee mcgehee mcghee mcgill mcgillivray mcginley mcginn mcginnis
mcginniss mcginty mcgirk mcgivern mcglone mcglothlin mcglynn mcgoldrick mcgough mcgowan mcgowen
mcgown mcgrath mcgraw mcgregor mcgrew mcgriff mcgruder mcguffin mcguigan mcguinness mcguire
mcgunnigle mcgurk mchale mchaney mchenry mchugh mcilwain mcinerney mcinnes mcinerny mcinnis
mcintire mcintosh mcinturf mcinturff mcintyre mcisaac mciver mckay mckee mckeever mckeithan
mckelvey mckelvy mckendrick mckenna mckenney mckenzie mckeon mckeown mckibben mckibbin mckim
mckinley mckinney mckinnon mckinstry mckirdy mckissick mcknight mckowen mckown mclain mclaren
mclaughlin mclaurin mclean mclellan mclemore mclendon mclennan mcleod mcleroy mclin mcloughlin
mcmahan mcmahon mcmanus mcmaster mcmasters mcmichael mcmichen mcmillan mcmillen mcmillian
mcmillin mcmullen mcmullin mcmurray mcmurrey mcmurtry mcnabb mcnair mcnally mcnamara mcnary
mcnatt mcnaughton mcneal mcneece mcneel mcneeley mcneely mcneese mcneil mcneill mcneilly
mcneil mcnew mcnicholas mcniel mcniff mcnish mcnulty mcnutt mcphee mcpherson mcphillips mcphail
mcquade mcquaid mcquain mcquay mcqueen mcquillan mcquillen mcquiston mcrae mcreynolds mcroberts
mcshane mcswain mcsweeney mctaggart mctigue mcvay mcveigh mcvicker mcwaters mcwhirter mcwhorter
mcwilliams meacham mead meade meader meadors meadow meadows meals meaney means mears mecham
mecklenburg medeiros medford medina medley medlin medrano medved mee meehan meek meeker meeks
mefford megan megger megginson mehan mehl mehler mehlman mehr mehta meier meijer meikle mein
meiner meiners meinert meinhardt meinhold meinke meisel meisenheimer meissner meister melanson
melcher melchers melchior melendez melia melton meltzer melville melvin memmott mena menard
mendez mendelson mendelsohn mendes mendez mendiola mendocino mendoza meneguzzo menendez menge
mengel menges menke menken menning mensch mentzer menzel meraz mercer merchant mercier
mercurio meredith merino merkel merkle merkley merlin merlo mermelstein merrick merrifield
merrill merriman merritt merry merryman mersch mershon mertens mertz merwin merz meserole
meserve meservey messer messick messina messinger messmer messner meszaros metcalf metcalfe
methvin metoyer mette metz metzger metzler meurer meyer meyers meyn meyrick mezger meza
michal michalak michalec michalek michalowski michals michalski michaud michel micheli michell
michelson mick mickel mickelson mickens mickey mickle mickler middlebrook middlebrooks middleton
midgley midkiff miele mier miers migliaccio mignon miguel mihal mihalik mikalauskas mike
mikesell mikolajczak mikolajczyk mikula mikulski milam milan milano milbrandt milburn mild
miles milford milholland milkowski mill millar millard miller millet millett milligan millikan
milliken milliman milliron millis millman millner mills millward milne milner milo milos milton
mims min minard minarik minch minchew mindel minder minear mineo miner miners ming mingo mingus
minick minier minix mink minkel minkler minks minnick minnie minnis minor minott minshall
minster minter minto minton mintz mir miracle miranda mireles miron mirza miser mishler miskell
missler mistretta mitchell mitchem mitchum mitsui mittelman mittelstaedt mix mixon mize mizell
mizner moak moats mobley mock mocks modlin moe moeller moen moench moffatt moffett moffitt
mogensen mohammad mohammed mohler mohr moir moisan mok mole molina molinari molinaro molitor
moll moller molloy molnar moloney molton mommsen monaco monaghan monahan moncada moncrief mondragon
mondy mone money monger moniz monk monks monreal monroe monson montague montalvo montana
montanez montano monte monteiro monteith montelongo montes montez montgomery monti montoya
montrose moody moon mooney moor moore moorman moorhead moorman morales moran morano moravec
morawski more moreau morehead morehouse morel moreland morell morelli moreno morey morgan morgans
morgenstern morin moritz morley mormon moroney morrell morrill morris morrison morriss morrow
morse mortensen mortenson mortimer morton mosby moseley moser moses mosher mosier moskowitz mosley
moss mosser mossman most mosteller mota mote moten motley moton mott motta motz moua mould
moulder moulds moultrie mount mountain mounts moura mouser mousseau mouton mowbray mower mowery
mowry moy moya moye moyer moyers moylan moynihan mroz mrozek much mucha muchmore muck mudd
mudgett muehlbauer mueller mueser muff muggleton muir muirhead mulcahy mulder muldoon mulford
mulhall mulholland mulkey mull mullan mullane mullaney mullen mullens muller mulligan mullin
mullinax mullings mullins mullis mulnix mulqueen mulroy mulvaney mulvey mulvihill mumaw mumford
mumm mummert munoz munroe munsell munson munz murakami murawski murch murchison murdoch
murdock murff murillo murphey murphy murray murrell murry musa musgrave musgrove mushinski
music musick musk musser musselman musso musson mustafa musto mutch mutchler muth muto mutschler
myer myers myhre myles myrick myszkowski
nagel nagy nairn nakamura nardi nash natale navarro navratil navratilova neal neff neil nelson
nemec nemcova neumann newman newton nguyen nichols nicholson nielsen niemann nieminen nikolic
nixon noble noel nolan noll nordstrom norman norris north norton novak novakova novotny novotna
nowak nowicki nunez nunn
oaks obrien oconnell oconnor odonnell ogden ohara oliver olsen olson olsson oneill ortiz osborne
oswald ott otto owen owens
pacheco page pages palacios palmer panek panekova pappas park parker parks parra parrish parsons
pascal paszkowski patel patterson patton paul paulsen pavlik pavlikova pavlov pavlova pawlak
payne pearson peck pedersen pelc peters petersen peterson petit petr petrik petrov petrova
pfeiffer pham phillips piccolo pickering pierce pierre pinto piotrowski pitman pittman pohl pokorny
pokorna polak polakova pollock pond poole pope popov popova porter pospisil pospisilova potter
poulsen powell powers pratt preston price prince pritchard prochazka prochazkova pruitt pugh
purcell quinn quintero
radke radek radovanovic raimondi ramirez ramos ramsey randall randolph rasmussen rath rauh ray
raymond reagan reed rees reese reeves reichert reid reilly reinhardt reinhard reiter renaud reuter
reyes reynolds rhodes ricci rice rich richard richards richardson richter ricketts riedel riley
rios ritchie ritter rivera rivers roach robbins roberson roberts robertson robinson robles roche
rodgers rodriguez roe rogers rohr rohde rojas roland roman romano romero rooney rosa rose rosen
rosenberg rosenfeld ross rossi roth rousseau rowe rowland roy rubio rudolph ruehle ruiz rush
russell russo rutherford ruzicka ruzickova ryan rybak
sabbagh sachs sadler sadowski saenz sager salazar salerno salinas salomon sampson sanchez sanders
sandoval sanford santana santiago santos sargent sato sauer saunders savage sawyer saxon sayers
schaefer schaeffer schafer schaffer schaller scharf scheer schell schenk scherer schiller schilling
schindler schlegel schmidt schmitt schmitz schneider schnitzer schober schoen schofield scholz
schon schramm schreiber schreiner schroder schroeder schubert schuler schulte schultz schulz
schulze schumacher schumann schuster schutz schwab schwartz schwarz schwarze schweitzer schweizer
scott scully sears sebesta sedlacek sedlackova seidel seifert seiler sellers serrano seth severin
sharp sharpe shaw shea sheehan sheldon shelton shepard shepherd sheppard sherman sherwood
shevchenko shields shimizu short shultz sibley siegel sierra sikora silva silver silverman simmons
simon simons simpson sims singh singleton skinner skoda sladek slama slater sloan slocum small
smart smirnov smirnova smith smyth snell snider snyder sobczak sobol sobotka sokol sokolov sokolova
solano solberg solis solomon sommer sommers song sorensen sosa soto soukup soukupova sousa
south spain spalding sparks spears spence spencer sperling spicer spiegel spiller spina spitzer
sprague springer stacey stack stafford stahl staley stanek stanley stanton staples stark starks
starr stauffer steele stefan stefanik stefanski stein steinberg steiner steinmetz stepanek
stepankova stephens stephenson sterling stern stevens stevenson stewart stiles still stokes
stoll stolz stone stoner storey story stout stowe straub strauss street strickland strnad strong
stroud stuart stubbs stuckey stultz stump sturm suarez subramanian suchy sucha sullivan summers
sumner sundberg sutherland sutton suzuki svoboda svobodova swain swan swanson sweeney sweet
swift sykes sylvester symons szabo szczepanski szymanski
tabor taft takahashi talbot tallman tam tan tanaka tang tanner tapia tate taylor teague temple
templeton tennant terry thacker thayer thibodeau thiel thiele thiemann thom thomas thompson
thomson thorne thornton thorpe thurman thurstons tidwell tierney tillman tilton timm timmons
tinker tipton titus tkac tkachenko tobin todd tolar tolbert toledo tolliver tomasek tomaskova
tomaszewski tomlin tomlinson tompkins tong torres toth townsend tracy tran trapp trask travis
traynor trevino trimmer tripp trost trott trotter trout trujillo trumble trump tucker tudor
tullis tully turnbull turner tuttle tyler tyrrell tyson
uhl uhlig uhlir ullmann ullrich ulrich umphrey underhill underwood unger upchurch upton urban
urbanek urbanova uribe usher upton utley
vaclavik valdez valenta valentova valentine valenzuela valerie vales valle vallejo valles vance
vandijk vanderbilt vandermeer vanek vankova varga vargas varner vasquez vaughan vaughn vazquez
vecera vega velasquez velazquez velez venter ventura vera verma vermeer verner vernon vesely
vesela vetter vick vickers victor vidal vieira viera vigil villa villalobos villanueva
villarreal villegas vincent vinson viola visser vlach vlcek vogel vogt voigt volk volkov
volkova volpe volz voss vrana vranova vrba vukovic
wachter waddell wade wagner wahl wahlberg wainwright wait waite wakefield wald walden waldo
waldron walker wall wallace waller wallin wallis walls walsh walter walters walther walton
wang ward warden ware warner warren washburn washington wasserman waterman waters watkins
watson watt watts weaver webb weber webster wedel weeks weber weigel weiler weinberg weiner
weinstein weir weis weise weiss weissman welch weld weldon weller wellman wells welsh wendel
wendt wenger wenk wentworth werner wert wertz wesley wessel wessels west westbrook westfall
weston westwood wetzel weyer whalen wheatley wheeler whelan whitaker white whitehead whitfield
whiting whitley whitlock whitman whitmore whitney whittaker whitten whittier wicks widmann
wiebe wiedemann wieland wiener wiese wiesner wiggins wight wilbur wilcox wilder wiley wilhelm
wilkerson wilkes wilkins wilkinson will willard willems willey williams williamson willis
wills wilmot wilson wilt wimmer winchester windham windsor wing winkler winn winningham
winslow winston winter winters wise wiseman wisniewski witkowski witt witte witten witthoeft
wittmann wlodarczyk wohler wojciechowski wojcik wojtas wolf wolfe wolff wolfgang wolford
woll wolter womack wong wood woodall woodard woodbridge woodbury woodcock wooden woodford
woodhull woodman woodruff woods woodson woodward woodworth woody wooldridge woolley woolsey
wooten wooten word wordsworth work workman works worley worman worrell worsham worth worthington
wray wren wright wrigley wrobel wu wuest wulf wulff wunderlich wyatt wylie wyman wynn wynne
xavier xu
yager yamada yamamoto yamashita yanez yang yanke yankee yarbrough yates yeager yearwood yee
yeomans yoder yokoyama york young younger youngblood yount yu yuen
zabel zach zacharias zack zahn zajac zajicek zak zakrzewski zaldivar zamora zander zapata
zappala zaragoza zarate zawadzki zeman zemanova zemke zempel zenker zepeda zero zhang zhao
zheng zhou zhu ziegler zielinski ziemann ziemba ziemer zimmer zimmerman zimmermann zink
zipper zito zobel zoller zook zorn zuber zucker zuckerman zuercher zuniga zweig zwick
`;

function buildNameSet(raw: string | string[]): Set<string> {
  const tokens = (Array.isArray(raw) ? raw : raw.trim().split(/\s+/))
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);
  return new Set(tokens);
}

const COMMON_FIRST_NAMES = buildNameSet(FIRST_NAME_WORDS);
const COMMON_SURNAMES = buildNameSet(SURNAME_WORDS);

export function foldAsciiLower(str: string): string {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (Math.abs(m - n) > 2) return 3;

  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (a[i - 1] === b[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = 1 + Math.min(prev, dp[j], dp[j - 1]);
      }
      prev = temp;
    }
  }
  return dp[n];
}

function findClosestDictionaryMatch(foldedWord: string, dict: Set<string>): string | null {
  if (!foldedWord || foldedWord.length < 3) return null;
  const maxDist = foldedWord.length <= 5 ? 1 : 2;
  let best: string | null = null;
  let bestDist = maxDist + 1;

  for (const cand of dict) {
    if (Math.abs(cand.length - foldedWord.length) > maxDist) continue;
    // Prioritizovat stejný počáteční nebo koncový znak pro vyšší přesnost návrhu
    if (cand[0] !== foldedWord[0] && cand[cand.length - 1] !== foldedWord[foldedWord.length - 1]) {
      continue;
    }
    const d = levenshtein(foldedWord, cand);
    if (d > 0 && d < bestDist) {
      bestDist = d;
      best = cand;
      if (d === 1) break;
    }
  }
  return best ? best.toUpperCase() : null;
}

const TITLE_TOKENS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'ing', 'mgr', 'judr', 'mudr', 'phdr', 'bc', 'herr', 'frau', 'pan', 'pani', 'prof']);

export function checkNameToken(
  rawValue: string,
  kind: 'firstName' | 'lastName',
  geminiHint?: { valid?: boolean; suggested?: string; reason?: string }
): NameTokenCheckResult {
  const clean = cleanCp1250Name(rawValue);
  const label = kind === 'firstName' ? 'jméno' : 'příjmení';
  const inLabel = kind === 'firstName' ? 've jméně' : 'v příjmení';

  if (!clean) {
    if (kind === 'firstName') {
      return { status: 'unverified', message: 'Křestní jméno není vyplněno.', matchedVia: 'heuristic' };
    }
    return { status: 'suspect', message: 'Chybí příjmení hosta.', matchedVia: 'heuristic' };
  }

  const dict = kind === 'firstName' ? COMMON_FIRST_NAMES : COMMON_SURNAMES;

  // 1. Kontrola číslic omylem přečtených jako písmena (0/1/5/8/4)
  if (/[0-9]/.test(rawValue)) {
    const baseReplace = (oneChar: 'I' | 'L') =>
      cleanCp1250Name(
        rawValue
          .replace(/0/g, 'O')
          .replace(/1/g, oneChar)
          .replace(/5/g, 'S')
          .replace(/8/g, 'B')
          .replace(/4/g, 'A')
      );
    const candI = baseReplace('I');
    const candL = baseReplace('L');
    const inDict = (val: string) => {
      const tokens = val.split(/[\s-]+/).filter(Boolean).map(foldAsciiLower);
      return tokens.length > 0 && tokens.every(t => dict.has(t));
    };
    const fixed =
      geminiHint?.suggested && cleanCp1250Name(geminiHint.suggested)
        ? cleanCp1250Name(geminiHint.suggested)
        : inDict(candL)
          ? candL
          : inDict(candI)
            ? candI
            : candI || candL;
    return {
      status: 'suspect',
      message: `Byly nalezeny číslice ${inLabel} (pravděpodobná chyba OCR).`,
      suggestion: fixed || undefined,
      matchedVia: 'heuristic'
    };
  }

  const parts = clean.split(/[\s-]+/).filter(Boolean);

  // 2. Kontrola zbytků titulů (MR, DR, ING...)
  const withoutTitles = parts.filter(p => !TITLE_TOKENS.has(foldAsciiLower(p)));
  if (withoutTitles.length !== parts.length && withoutTitles.length > 0) {
    return {
      status: 'suspect',
      message: `Obsahuje akademický titul nebo oslovení (${label} má být bez titulů).`,
      suggestion: withoutTitles.join(' '),
      matchedVia: 'heuristic'
    };
  }

  // 3. Trojice stejných písmen (klasická chyba OCR / tisku)
  if (/(.)\1{2,}/.test(clean)) {
    const dedup = clean.replace(/(.)\1{2,}/g, '$1$1');
    return {
      status: 'suspect',
      message: `Neobvyklé zdvojení/ztrojení písmene ${inLabel}.`,
      suggestion: dedup,
      matchedVia: 'heuristic'
    };
  }

  // 4. Přesná shoda se slovníkem (včetně víceslovných jmen / složených příjmení)
  const foldedParts = parts.map(foldAsciiLower);
  const allInDict = foldedParts.length > 0 && foldedParts.every(p => dict.has(p));
  if (allInDict) {
    // Pokud Gemini výslovně navrhlo opravu na základě fotografie dokladu, přesto ji ukaž jako podezření
    if (
      geminiHint?.suggested &&
      foldAsciiLower(geminiHint.suggested) !== foldAsciiLower(clean) &&
      cleanCp1250Name(geminiHint.suggested)
    ) {
      return {
        status: 'suspect',
        message: geminiHint.reason || `Gemini navrhuje přesnější přepis ${label} z formuláře.`,
        suggestion: cleanCp1250Name(geminiHint.suggested),
        matchedVia: 'gemini'
      };
    }
    return {
      status: 'verified',
      message: `${kind === 'firstName' ? 'Jméno' : 'Příjmení'} potvrzeno ve slovníku.`,
      matchedVia: 'dictionary'
    };
  }

  // 5. Gemini explicitně vrátilo návrh opravy nebo označilo jméno za podezřelé
  if (
    geminiHint?.suggested &&
    foldAsciiLower(geminiHint.suggested) !== foldAsciiLower(clean) &&
    cleanCp1250Name(geminiHint.suggested)
  ) {
    return {
      status: 'suspect',
      message: geminiHint.reason || `Neobvyklý tvar ${label} – možný překlep OCR.`,
      suggestion: cleanCp1250Name(geminiHint.suggested),
      matchedVia: 'gemini'
    };
  }

  // 6. Kontrola chybějících samohlásek u delších slov (>= 4 znaky)
  for (const fp of foldedParts) {
    if (fp.length >= 4 && !/[aeiouy]/.test(fp)) {
      return {
        status: 'suspect',
        message: `${kind === 'firstName' ? 'Jméno' : 'Příjmení'} „${fp.toUpperCase()}“ neobsahuje žádnou samohlásku (pravděpodobný OCR překlep).`,
        matchedVia: 'heuristic'
      };
    }
    if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(fp) && !/sch|krzy|strz|szcz/.test(fp)) {
      const fuzzy = findClosestDictionaryMatch(fp, dict);
      return {
        status: 'suspect',
        message: `Neobvyklý shluk souhlásek ${inLabel} „${fp.toUpperCase()}“.`,
        suggestion: fuzzy || undefined,
        matchedVia: fuzzy ? 'fuzzy' : 'heuristic'
      };
    }
  }

  // 7. Pokud Gemini nepotvrdilo validitu, zkusit najít blízký překlep ve slovníku (Levenshtein 1)
  if (geminiHint?.valid !== true && foldedParts.length === 1) {
    const fp = foldedParts[0];
    const closeMatch = findClosestDictionaryMatch(fp, dict);
    if (closeMatch && levenshtein(fp, closeMatch.toLowerCase()) === 1) {
      return {
        status: 'suspect',
        message: `Možný 1písmenný překlep OCR ${inLabel}.`,
        suggestion: closeMatch,
        matchedVia: 'fuzzy'
      };
    }
  }

  // 8. Potvrzení z Gemini jazykové kontroly (vzácnější, ale reálné zahraniční jméno)
  if (geminiHint?.valid === true) {
    return {
      status: 'verified',
      message: `${kind === 'firstName' ? 'Jméno' : 'Příjmení'} potvrzeno jazykovou kontrolou.`,
      matchedVia: 'gemini'
    };
  }

  if (geminiHint?.valid === false) {
    return {
      status: 'suspect',
      message: geminiHint.reason || `${kind === 'firstName' ? 'Jméno' : 'Příjmení'} působí podezřele – zkontrolujte dle dokladu.`,
      matchedVia: 'gemini'
    };
  }

  // 9. Výchozí stav pro vzácná / exotická jména mimo slovník
  if (clean.length === 1) {
    return {
      status: 'suspect',
      message: `Jednopísmenné ${label} – pravděpodobně nedokončené čtení OCR.`,
      matchedVia: 'heuristic'
    };
  }

  return {
    status: 'unverified',
    message: `Méně obvyklé ${label} mimo základní slovník – doporučeno zkontrolovat.`,
    matchedVia: 'dictionary'
  };
}

export function verifyGuestNameOcr(
  firstName: string,
  lastName: string,
  geminiHint?: GeminiNameCheckHint
): GuestNameVerification {
  const firstNameCheck = checkNameToken(firstName, 'firstName', {
    valid: geminiHint?.firstNameValid,
    suggested: geminiHint?.suggestedFirstName,
    reason: geminiHint?.reason
  });
  const lastNameCheck = checkNameToken(lastName, 'lastName', {
    valid: geminiHint?.lastNameValid,
    suggested: geminiHint?.suggestedLastName,
    reason: geminiHint?.reason
  });

  return {
    firstName: firstNameCheck,
    lastName: lastNameCheck,
    hasWarning: firstNameCheck.status !== 'verified' || lastNameCheck.status !== 'verified'
  };
}

const ISO3_TO_ISO2: Record<string, string> = {
  CZE: 'cz', SVK: 'sk', DEU: 'de', AUT: 'at', POL: 'pl', GBR: 'gb', USA: 'us',
  FRA: 'fr', ITA: 'it', ESP: 'es', NLD: 'nl', CHE: 'ch', UKR: 'ua', HUN: 'hu',
  ROU: 'ro', BGR: 'bg', HRV: 'hr', SVN: 'si', BEL: 'be', DNK: 'dk', SWE: 'se',
  NOR: 'no', FIN: 'fi', IRL: 'ie', PRT: 'pt', GRC: 'gr', TUR: 'tr', CAN: 'ca',
  AUS: 'au', NZL: 'nz', JPN: 'jp', KOR: 'kr', CHN: 'cn', TWN: 'tw', IND: 'in',
  ISR: 'il', BRA: 'br', MEX: 'mx', ARG: 'ar', RUS: 'ru', BLR: 'by', LTU: 'lt',
  LVA: 'lv', EST: 'ee', LUX: 'lu', ISL: 'is', SRB: 'rs', BIH: 'ba', MKD: 'mk',
  MNE: 'me', ALB: 'al', MDA: 'md', GEO: 'ge', ARM: 'am', KAZ: 'kz', VNM: 'vn',
  THA: 'th', SGP: 'sg', PHL: 'ph', IDN: 'id', MYS: 'my', ZAF: 'za', EGY: 'eg',
  MAR: 'ma', TUN: 'tn', ARE: 'ae', SAU: 'sa', COL: 'co', CHL: 'cl', PER: 'pe'
};

export function iso3ToIso2(iso3?: string): string {
  const code = normalizeCountryCode(iso3);
  return ISO3_TO_ISO2[code] || '';
}

export function checkAddressStructure(street?: string, city?: string): string | null {
  const s = (street || '').trim();
  const c = (city || '').trim();
  if (!c) return 'Chybí město (obec) trvalého bydliště.';
  if (/^\d+$/.test(c)) return 'Město nesmí být tvořeno pouze číslicemi.';
  if (s && /^\d+$/.test(s)) return 'Ulice nesmí být tvořena pouze číslicemi.';
  if (c.length > 42) return `Město (${c.length} znaků) překračuje limit UbyPort (42 znaků).`;
  if (s.length > 42) return `Ulice (${s.length} znaků) překračuje limit UbyPort (42 znaků).`;
  if (/[|~^=@$]|\?\?/.test(`${s} ${c}`)) return 'Adresa obsahuje neobvyklé znaky pravděpodobně z chybného OCR.';
  return null;
}

// Cache pro OSM Nominatim v rámci relace + zdvořilé frontování požadavků (1 dotaz za ~1.1 s)
const osmCache = new Map<string, AddressVerificationResult>();
let nominatimQueue: Promise<any> = Promise.resolve();
let lastNominatimCallAt = 0;

async function fetchNominatimJson(url: string, signal?: AbortSignal): Promise<any[]> {
  const task = nominatimQueue.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, 1100 - (now - lastNominatimCallAt));
    if (waitMs > 0) {
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
    if (signal?.aborted) {
      throw new Error('ABORTED');
    }
    lastNominatimCallAt = Date.now();
    const resp = await fetch(url, {
      headers: {
        Accept: 'application/json'
      },
      signal
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }
    const data = await resp.json();
    return Array.isArray(data) ? data : [];
  });

  nominatimQueue = task.catch(() => []);
  return task;
}

function extractCityFromOsmAddress(addr: any): string {
  if (!addr || typeof addr !== 'object') return '';
  return String(
    addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.hamlet ||
      addr.suburb ||
      addr.county ||
      ''
  ).trim();
}

export async function verifyGuestAddressOsm(
  params: {
    street?: string;
    city?: string;
    residenceCountry?: string;
    nationality?: string;
  },
  signal?: AbortSignal
): Promise<AddressVerificationResult> {
  const street = cleanCp1250Bydliste(params.street || '');
  const city = cleanCp1250Bydliste(params.city || '');
  const countryIso3 = normalizeCountryCode(params.residenceCountry || params.nationality);
  const countryIso2 = iso3ToIso2(countryIso3);

  const structuralErr = checkAddressStructure(street, city);
  if (structuralErr) {
    return {
      status: 'suspect',
      message: structuralErr
    };
  }

  const cacheKey = `guest|${countryIso2}|${city.toLowerCase()}|${street.toLowerCase()}`;
  const cached = osmCache.get(cacheKey);
  if (cached) return cached;

  try {
    // 1. Strukturovaný dotaz (ulice + město + stát)
    const baseParams = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      limit: '3',
      'accept-language': 'cs,en'
    });
    if (countryIso2) {
      baseParams.set('countrycodes', countryIso2);
    }

    let results: any[] = [];
    if (street) {
      const q1 = new URLSearchParams(baseParams);
      q1.set('street', street);
      q1.set('city', city);
      results = await fetchNominatimJson(`https://nominatim.openstreetmap.org/search?${q1.toString()}`, signal);
    }

    // 2. Záložní volný dotaz (pokud strukturované párování ulice+číslo selhalo)
    if (results.length === 0) {
      const q2 = new URLSearchParams(baseParams);
      q2.set('q', [street, city].filter(Boolean).join(', '));
      results = await fetchNominatimJson(`https://nominatim.openstreetmap.org/search?${q2.toString()}`, signal);
    }

    if (results.length > 0) {
      const best = results[0];
      const addr = best.address || {};
      const osmCity = cleanCp1250Bydliste(extractCityFromOsmAddress(addr) || city);
      const osmRoad = cleanCp1250Bydliste(addr.road || addr.pedestrian || addr.residential || '');
      const osmHouse = cleanAsciiUpper(addr.house_number || '');
      const osmStreet = osmRoad ? [osmRoad, osmHouse].filter(Boolean).join(' ') : street;
      const osmCountry = String(addr.country_code || countryIso2 || '').toUpperCase();

      const res: AddressVerificationResult = {
        status: street && !osmRoad ? 'partial' : 'verified',
        message:
          street && !osmRoad
            ? `Město „${osmCity}“ ověřeno v mapě OSM, přesná ulice nebyla spárována.`
            : `Adresa ověřena v OSM (${[osmStreet, osmCity, osmCountry].filter(Boolean).join(', ')}).`,
        normalizedStreet: osmStreet || street,
        normalizedCity: osmCity || city,
        normalizedPostalCode: String(addr.postcode || '').replace(/\s+/g, ''),
        normalizedCountry: countryIso3,
        displayName: best.display_name
      };
      osmCache.set(cacheKey, res);
      return res;
    }

    // 3. Ověření alespoň samotného města (aby uživatel věděl, jestli je chyba v ulici nebo v celém městě)
    if (street) {
      const qCity = new URLSearchParams(baseParams);
      qCity.set('city', city);
      const cityResults = await fetchNominatimJson(`https://nominatim.openstreetmap.org/search?${qCity.toString()}`, signal);
      if (cityResults.length > 0) {
        const bestCity = cityResults[0];
        const osmCity = cleanCp1250Bydliste(extractCityFromOsmAddress(bestCity.address) || city);
        const partialRes: AddressVerificationResult = {
          status: 'partial',
          message: `Město „${osmCity}“ v OSM existuje, ale ulici „${street}“ se nepodařilo najít (zkontrolujte OCR přepis ulice/čísla).`,
          normalizedCity: osmCity,
          normalizedStreet: street,
          normalizedCountry: countryIso3,
          displayName: bestCity.display_name
        };
        osmCache.set(cacheKey, partialRes);
        return partialRes;
      }
    }

    const notFoundRes: AddressVerificationResult = {
      status: 'suspect',
      message: `Adresa „${[street, city].filter(Boolean).join(', ')}“ nebyla v OpenStreetMap pro stát ${countryIso3 || '?'} nalezena.`
    };
    osmCache.set(cacheKey, notFoundRes);
    return notFoundRes;
  } catch (err: any) {
    if (err?.message === 'ABORTED' || err?.name === 'AbortError') {
      return { status: 'idle', message: '' };
    }
    return {
      status: 'error',
      message: 'Mapová kontrola OSM je momentálně nedostupná (zkontrolujte připojení).'
    };
  }
}

export async function verifyCzechPropertyAddressOsm(
  rawAddress: string,
  districtKey?: string,
  signal?: AbortSignal
): Promise<AddressVerificationResult> {
  const clean = (rawAddress || '').trim();
  if (!clean) {
    return { status: 'suspect', message: 'Nejprve zadejte adresu ubytovacího zařízení.' };
  }

  const cacheKey = `czprop|${clean.toLowerCase()}`;
  const cached = osmCache.get(cacheKey);
  if (cached) return cached;

  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      addressdetails: '1',
      countrycodes: 'cz',
      limit: '3',
      'accept-language': 'cs',
      q: clean
    });
    const results = await fetchNominatimJson(`https://nominatim.openstreetmap.org/search?${params.toString()}`, signal);
    if (results.length === 0) {
      const notFound: AddressVerificationResult = {
        status: 'suspect',
        message: 'Adresu v ČR se nepodařilo najít v OpenStreetMap – zkontrolujte ulici, číslo a PSČ.'
      };
      osmCache.set(cacheKey, notFound);
      return notFound;
    }

    const best = results[0];
    const addr = best.address || {};
    const localParsed = parseCzechAddress(clean, districtKey);

    const osmRoad = String(addr.road || addr.pedestrian || localParsed.street || '').trim();
    const rawHouse = String(addr.house_number || '').trim().toUpperCase();
    const houseMatch = rawHouse.match(/^(\d{1,4}E?)(?:\/(\d{1,3}[A-Z]?))?$/);
    const houseNum = houseMatch ? houseMatch[1] : localParsed.houseNumber;
    const orientNum = houseMatch && houseMatch[2] ? houseMatch[2] : localParsed.orientationNumber;

    const postcode = String(addr.postcode || localParsed.postalCode || '').replace(/\D/g, '').slice(0, 5);
    const municipality = String(
      addr.city || addr.town || addr.village || addr.municipality || localParsed.municipality || ''
    ).trim();
    const cityPart = String(addr.suburb || addr.quarter || addr.city_district || localParsed.cityPart || '').trim();
    const district = String(
      municipality.toLowerCase() === 'praha'
        ? (addr.city_district || addr.borough || localParsed.district || '')
        : (addr.county || localParsed.district || '')
    )
      .replace(/^okres\s+/i, '')
      .replace(/^Městská část\s+/i, '')
      .trim();

    const formattedStreet = [osmRoad, [houseNum, orientNum].filter(Boolean).join('/')].filter(Boolean).join(' ');

    const res: AddressVerificationResult = {
      status: osmRoad || municipality ? 'verified' : 'partial',
      message: `Česká adresa ověřena v OSM (${[formattedStreet, postcode, municipality].filter(Boolean).join(', ')}).`,
      normalizedStreet: osmRoad,
      normalizedCity: municipality,
      normalizedMunicipality: municipality,
      normalizedCityPart: cityPart,
      normalizedDistrict: district,
      normalizedPostalCode: postcode,
      displayName: best.display_name
    };
    osmCache.set(cacheKey, res);
    return res;
  } catch (err: any) {
    if (err?.message === 'ABORTED' || err?.name === 'AbortError') {
      return { status: 'idle', message: '' };
    }
    return {
      status: 'error',
      message: 'Mapová kontrola OSM není momentálně dostupná.'
    };
  }
}
