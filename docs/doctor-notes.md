# A doctor's notes on depression and relapse

Informal remarks from a practising doctor, written in a chat on 13 Nov 2026 while the
team was exploring the Junction 2026 challenge "Beyond the Clinic" (staying well at home
after depression treatment). They are one clinician's working model, not clinical
guidance. The doctor is not named.

How to read this file:

- Each remark is given in the original Finnish, followed by an English rendering.
- "Checked" lines say what a literature check found, with the file that holds the
  sources. Those checks read abstracts, not full papers.
- The doctor's product and game ideas are brainstorming, not medical facts. The team's
  note on this (13 Nov 2026): "his feature ideas are not medical facts though of course
  he has some insights". Remarks that are ideas are marked **Idea**; section 9 collects
  the ones that are only ideas.
- The last section is the team's own direction on measuring, not the doctor's words.

## 1. How to approach the problem

> Lähtisin liikkeelle kartoittamalla mitä masennus on biologisesti ja miten se ilmenee ihmisessä, ja millainen mitattava rajapinta siinä on noilla teknologioilla. Sit toinen ulottuvuus on, että mikä siihen masennukseen auttaa, ja miten sitä toiminnallisuutta voidaan seurata, mitata tai boostata. Sit on tietty hoitojen seuranta, joka on tavallaan triviaalimpaa

I would start by mapping what depression is biologically, how it shows in a person, and
what measurable interface these technologies have to it. The second dimension is what
helps against depression, and how that can be followed, measured or boosted. Then there
is treatment follow-up, which is in a way more trivial.

> Eli sit ylläpidossa tärkeää ois saada siihen joku malli homeostaasista, eli miten se ihminen joko pitää yllä tasapainoa tai jos tulee joku negatiivinen triggeri, niin miten se käsittelee sitä ennen kuin on liian syvällä suossa

So in maintenance it would be important to have a model of homeostasis: how the person
either keeps their balance or, when a negative trigger comes, how they handle it before
they are too deep in the swamp.

Checked: slowing recovery from small setbacks is a proposed early warning, but in a
prospective study it preceded only about a third of recurrences
(`research/evidence-check.md`, section 1). Researchers usually say "allostasis" for a
balance that is actively maintained.

## 2. The mechanism: feeling drives thinking and action

> Mut masentunut ihminen yleisesti ottaen käsittelee vaikeita tunteita patologisesti ja sit se johtaa uupumiseen, siihen, ettei mikään kiinnosta ja sellaseen vallitsevaan surulliseen tunnetilaan josta ei tunnu pääsevän pois

A depressed person generally processes difficult feelings pathologically, and that leads
to exhaustion, to nothing being of interest, and to a prevailing sad state that there
seems to be no way out of.

> Ja se tunnetila taas sitten aiheuttaa, että yrittää ratkaista ongelmia, joita ei oikeastaan välttämättä edes tarttis ratkaista (voivat olla vaikka jotain vanhoja asioita, joille ei voi tehdä mitään)

And that state in turn makes the person try to solve problems that do not really need
solving (they may be old things nothing can be done about).

> sykologisemmin se tila muistuttaa jotain sisäistä taistelua missä järki tavallaan häviää tunteille tai jotain vastaavaa ja sit toiminta lamautuu

More psychologically, the state resembles an inner struggle in which reason in a way
loses to the feelings, and then action is paralysed.

> Sit ihan keskeinen mekanismi mikä tekee tosta 'vaikeaa' hoitaa on se, että järkeily ei juuri auta siihen, koska ne ajatukset seuraa tunteita eikä toisinpäin

A central mechanism that makes this "hard" to treat is that reasoning hardly helps,
because the thoughts follow the feelings and not the other way round.

> Ja sama tietty pätee tekoihin. Eli keskeistä on saada muutettua se tunnetila, mut sitä ei voi suoraan komentaa

The same of course holds for actions. So the key is to change the emotional state, but
it cannot be commanded directly.

> Mut lopputuloksena on ihminen jonka tunne-elämän, ajattelu ja toiminta on kaikki jumissa, mikä on aika sietämätön tila ja ahdistaa niin paljon että ihminen voi olla valmis ratkaisee sen itsarilla

The end result is a person whose emotional life, thinking and action are all stuck,
which is a fairly unbearable state and so distressing that the person may be ready to
resolve it by suicide.

Checked: that mood biases memory and judgement is well supported, and changing thinking
directly has weak effects on mood. "Reasoning hardly helps" is too strong as stated,
since cognitive therapy works (`research/3-state-shifters.md`, section D). Any product
built on these notes needs a crisis path to a person and to emergency help.

## 3. Effort and routines

> Ja sit yks juttu viel mikä on keskeinen, mitä ei ehkä tossa suoraan tullut... eli että muutoksen tekeminen vaatii yleensä tietoista effortia, mutta juuri se tietoinen efforti on heikentynyt

One more central thing: making a change usually takes conscious effort, but that
conscious effort is exactly what is weakened.

> Eli sun pitäis opetella tekemään ja näkemään asiat eri tavalla ja miten vaik päästä eri tunnetiloihin eri tilanteissa jne., mutta sit ne resurssit mitä tarttis siihen opetteluun kuluu siihen, miten sä tunnet, teet ja näet asiat

You would need to learn to do and see things differently, and how to reach different
emotional states in different situations, but the resources that learning needs are
used up by how you feel, act and see things.

> Eli masentuneella ihmisellä on ei pelkästään heikot, vaan huonot rutiinit

So a depressed person has not just weak routines but bad ones.

> ne voi olla vielä ihan sairaan vahvoja sillai että ihminen tosi säntillisesti vaikka soimaa itseään tai kieltää itseltään kaiken kivan

They can be extremely strong: the person very punctually blames themselves, for
example, or denies themselves everything pleasant.

Checked: impaired effortful control is supported, with a refinement: depressed people
can use a strategy when prompted, and what fails is starting it themselves. Rumination
as a habit is a credible account; replacing it with cue-based plans is untested in
people recovered from depression (`research/3-state-shifters.md`, section D).

## 4. Memory and the growing list of negatives

> Esimerkki, ... sä voisit spontaanisti ilostua kun joku tulee hymyillen vastaan (ja näin ehkä kävikin jossain kohtaa elämäää), mutta sit muistatkin automaaattisesti että siitä seuraa vain kärsimystä, koska vuosikymmeniä sitten oli parisuhde sen AINOAN ihmisen kanssa, jonka kanssa koskaan klikkasi, jonka sössit huonoilla sosiaalisilla taidoilla, ja sen jälkeen elämällä ei oo ollut mitään merkitystä, ja toisaalta et koskaan oppinut sosiaalisia taitoja, ja ootkin oppinut, että et oikeastaan edes halua olla ihmisten kanssa, eikä ne sosiaaliset jutut ei oikeastaan koskaan ollut edes sun juttu, ja ihmisten kohtaaminen tuntuukin nyt siltä kuin olisit erämaassa ja vastaan kävelee vihamielisen heimon jäsen

An example (hypothetical): you could spontaneously feel glad when someone comes towards
you smiling, and perhaps you once did. But then you automatically remember that only
suffering follows, because decades ago there was a relationship with the ONLY person
you ever clicked with, which you ruined with poor social skills, and since then life
has had no meaning; and you never learned social skills, and you have learned that you
do not really even want to be with people, and social things were never your thing
anyway; and meeting people now feels like being in the wilderness with a member of a
hostile tribe walking towards you.

> sit kun elämä on paskaa niin niitä negatiivisia kokemuksia kertyy sellainen jatkuvasti kasvava lista mihin on helppo tarttua, koska siinä on sellainen confirmation bias

And when life is awful, negative experiences pile up into an ever-growing list that is
easy to grab onto, because there is a confirmation bias in it.

> joillain ihmisillä se tuntuu olevan kiinni jostain yhdestä isosta asiasta josta ei pääse yli

For some people it seems to hang on one big thing they cannot get over.

> siis tyyliin joku mikä herättää suuria vääryyden tunteita ja sit siihen verrattuna mikään muu ei tunnu miltään

Something that arouses a great sense of injustice, and compared with it nothing else
feels like anything.

Checked: in people who have recovered, a low mood does bring negative thinking back out;
whether that predicts relapse differs between studies
(`research/2-mental-measures.md`, claim 6). Asking a depressed person to recall happy
memories can worsen mood (`research/3-state-shifters.md`, section A).

## 5. Perception turns negative

> Yks ihan mielenkiintoinen yhteys vaikka unen laadulla ja masennuksella on, että (keskimäärin) jos nukut huonosti, niin sekä muut ihmiset että itse näkee sut epämiellyttävämpänä/vanhempana/rumempana/pahantahtoisempana jne., mutta myös sä näet ne muut negatiivisemmin, esim. hymy = ivallinen, sarkastinen, viattomat kommentit on kiusaamista jne., ja tää sama tulee kans masentuneilla tai vaikka jos kärsii kivusta jne., varmasti tää on jotenkin adaptiivista sillai että muut vois esim. välittää enemmän mut ne ei välttämättä tee sitä

One interesting link between sleep quality and depression: on average, if you sleep
badly, both other people and you yourself see you as more unpleasant, older, uglier,
more ill-willed and so on; but you also see others more negatively, for example a smile
reads as mocking or sarcastic and innocent comments as bullying. The same happens in
depression, or when someone is in pain. This is surely adaptive somehow, in that others
might care more, but they do not necessarily do so.

> eli siis havainnot ja tulkinnat alkaa vääristyä

So perceptions and interpretations start to distort.

> niin periaatteessa vois jossain pelissä vaik havainnoida sitä miten negatiivisena näkee ärsykkeet

**Idea**: so in principle a game could observe how negatively a person sees stimuli.

> ahdistuneena kans vaikka kovat äänet alkaa pelästyttää

When anxious, loud sounds for example start to startle.

> jos se negatiivisuusbias kasvaa niin on yleensä stressaantunut, nukkunut huonosti ja jos siinä on taustalla masennus niin todnäk myöskin ne ajatukset alkaa aktivoitua, koska niitä se masentunut ihminen on treenannut tosi paljon

If the negativity bias grows, the person is usually stressed or has slept badly, and if
depression is in the background, the thoughts probably start to activate too, because
the depressed person has practised them a great deal.

Checked (`research/2-mental-measures.md`, section C): a negative interpretation bias in
depression is solid and persists in recovered people. The sleep claims are partly
supported. That the bias rises with stress and poor sleep within one person is
contested: no study tracked it across bad days. A game that rates ambiguous faces or
scenarios is the best-supported task, with low reliability, so it suits a weekly trend
and not a daily alarm.

## 6. Avoidance

> njoo ja sit yks kans näkökulma on ns. välttelykäyttäytyminen

Another angle is so-called avoidance behaviour.

> Eli se peli vois jotenkin mitata sitä kapeuttaako se ihminen elämänpiiriään ... vähän niinkuin että mikä sen reviiri/toimijuuden alue o

**Idea**: the game could somehow measure whether the person is narrowing their sphere of life:
roughly, what their territory or area of agency is.

> Esim., depiksessä ihminen eiu nouse sängystä koska päivät on paskaa, ja odottaa vain että pääsee nukkumaan

For example, in depression a person does not get out of bed because the days are awful,
and just waits to get back to sleep.

> mikä on sillee .. noh, yleistynyttä välttelyä, eli joku toinen vois vaikka vältellä vaan hämähäkkejä, mut sit depistynyt ihminen välttelee periaatteessa kaikkea - ja jää yksin niiden paskojen ajatustensa kaa

Which is generalised avoidance: someone else might avoid only spiders, but a depressed
person avoids basically everything, and is left alone with those awful thoughts.

> se mikä auttais ois tehdä IHAN MITÄ TAHANSA muuta jotta sais ajatukset pois siitä

What would help is to do ANYTHING else, to get the thoughts off it.

> ja siis noh, aika epäkorrektia, mutta melkeinpä varmaa että masentunut jotenkin salaa nauttii siitä paskasta jollain twisted tasolla

And, well, this is rather incorrect to say, but it is almost certain that a depressed
person somehow secretly enjoys it on some twisted level.

> ainakin usein on kaikenlaista itsensärankaisua jne

At least there is often all kinds of self-punishment.

> ja sit kyvyttömyyttä ymmärtää että mikä nyt oikeastaan on hyvä juttu ja mikä ei

And an inability to understand what actually is a good thing and what is not.

Checked (`research/2-mental-measures.md`, section F): time alone and inactivity track
same-day symptoms within a person; no evidence was found that a shrinking range comes
before relapse. That avoidance is generalised is contested. Doing something else does
interrupt the thoughts, short-term only. Difficulty judging what is good is partly
supported, as reduced wanting and reward learning. No source was found for
self-punishment or for the "secretly enjoys" remark.

## 7. Personality

> Tottakai tossa ihmisen persoonallisuudella on tosi iso rooli, käytännössä niin että neuroottiset ihmiset näkee uhkia herkemmin, ja sit taas vaativat ihmiset on itselleen armottomia, noin esimerkkeinä

Of course personality plays a very big role: in practice, neurotic people see threats
more readily, and demanding people are merciless towards themselves, as examples.

Checked: neuroticism and self-criticism are risk factors. Matching the intervention to
personality type has no trial behind it (`research/evidence-check.md`, section 11).

## 8. Therapies named

> MBCT-niminen terapia on kehitetty nimenomaan toistuvaa masennusta ehkäisee, mikä ehkä sopis tohon tehtävänantoon

A therapy called MBCT was developed specifically to prevent recurrent depression, which
might suit the brief.

> ja sit CBASP esim. on kehitetty pitkäaikaiseen masennukseen joka on enemmänkin persoonallisuustason ongelma usein kuin selkeämpi masennus

And CBASP, for example, was developed for long-term depression, which is often more a
personality-level problem than clear-cut depression.

> eli sellainen että ihminen voisi realistisesti parantaa tilannettaan, muttei usko siihen

That is, the kind where the person could realistically improve their situation but does
not believe it.

Checked: MBCT cuts relapse risk by about 30% (`research/evidence-check.md`, section 3).
CBASP has support in chronic depression but added nothing over optimised medication in
people who had not responded to medication, the group closest to TMS patients
(`research/3-state-shifters.md`, section C).

## 9. Feature ideas (brainstorming, not clinical claims)

The measuring ideas in sections 5 and 6 are also **Ideas**: a game that observes how
negatively a person sees stimuli, and a game that measures whether a person is
narrowing their sphere of life.

> yks hauska ja disturbing feature tollaseen peliin vois olla jos se somettais sun puolesta ottamalla yhteyttä ystäviin ;)

**Idea**, said as a joke: a funny and disturbing feature for such a game would be if it
did your social media for you by contacting your friends ;)

> sillee "täältä haudan takaa vaan kurkottelen..."

Like "just reaching out from beyond the grave here..."

> Jotain juttuja on mitkä tutkitusti auttaa ainakin lievemmässä depiksessä on sellaset missä kirjottamalla tietoisesti käsitellään omaa elämäntarinaa ja mihin on menossa elämässä, mitä haluaa jne

Some things that research shows help, at least in milder depression, are ones where you
consciously work through your own life story in writing: where you are going in life,
what you want and so on.

> mut se ei kyl sit taas toimi jos on kunnon depis enää, mut vois toimia tollases pelissä

**Idea**: that no longer works once the depression is severe, but it could work in a
game like that.

> ideaalisesti tollanen peli rakentais sillan sieltä "ylläpito"vaiheesta johonkin missä se ihminen aktiivisesti tekee ei-masentuneita asioita :D

**Idea**: ideally such a game would build a bridge from the "maintenance" phase to
something where the person actively does non-depressed things :D

> siis jotain idk, luovaa

Something, I don't know, creative.

> mut se on aika high bar

But that is quite a high bar.

Checked: not yet. The writing claim (that it helps in milder depression and not in
severe depression) has not been looked up. An app that contacts friends on a person's
behalf would need that person's clear consent each time; the research on what users
want points to social connection as something that keeps people engaged
(`research/5-products-and-gap.md`, section B).

## 10. The team's direction on measuring

These are the team's own words (13 Nov 2026), not the doctor's.

- "Something that we can measure at least statistically while at home with the help of
  relatively cheap electronics"
- "Even though I mentioned physical symptoms also the mental symptoms that can be
  measured is important, for example grading negativity, tiredness etc by for example
  the help of a questionaire. Questionaire is kind of nice so that it takes effort, if
  the person is unable to make the effort and answer it is also data"
- "We will look into gaining data from very good AI assisted cameras that were demoed
  here as well as oura smart ring. The camera can track for example eyeballs quite well
  apparently"
