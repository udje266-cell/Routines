import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { C } from '@/components/ui';

/** Explications en mots simples, ouvertes par un petit « ? ». */
export const AIDE = {
  peutDepenser: {
    titre: 'Je peux dépenser aujourd’hui',
    texte: 'C’est ce que vous pouvez dépenser aujourd’hui sans toucher à l’argent de vos factures. L’application a déjà mis de côté le loyer, la CIE, la SODECI… jusqu’à votre prochaine paie, puis a partagé le reste entre les jours qui restent.\n\nSi vous dépensez moins aujourd’hui, le chiffre de demain sera un peu plus grand.',
  },
  manque: {
    titre: 'Il vous manque',
    texte: 'Avec l’argent que vous avez maintenant, vous ne pourrez pas payer toutes vos factures avant la paie. Reportez ce qui peut attendre, demandez à décaler une facture, et notez chaque petite somme reçue : elle réduit ce manque.',
  },
  calendrier: {
    titre: 'Le calendrier du mois',
    texte: 'Point vert : de l’argent arrive ce jour-là. Point rouge : de l’argent sort (facture, dépense prévue).\n\nTouchez un jour pour voir ce qui est prévu, puis « + Entrée » ou « + Sortie » pour ajouter quelque chose que vous savez déjà (un ami qui vous rembourse le 20, l’école à payer le 15…). « Voir le mois » affiche tout le mois.',
  },
  anneau: {
    titre: 'Le jour du mois',
    texte: 'L’anneau montre où vous en êtes dans votre mois de budget (de paie à paie). Plus il est rempli, plus la prochaine paie approche.',
  },
  plan: {
    titre: 'Mon plan du mois',
    texte: 'Entrées prévues : tout l’argent qui arrive ce mois-ci.\nSorties prévues : vos factures et dépenses connues.\nDettes à rembourser : la part de vos dettes à payer ce mois-ci (une dette sans date est étalée sur 3 mois ; une dette datée, jusqu’à sa date).\nIl reste : la différence.\n\nEnsuite, l’application vous dit combien mettre de côté, quel jour (de préférence le jour de la paie, avant toute dépense) et combien dépenser au maximum par jour. Suivez simplement les étapes numérotées.',
  },
  agenda: {
    titre: 'L’agenda',
    texte: 'Tout ce qui est prévu sur les 2 prochains mois, jour par jour, avec l’argent qu’il vous restera après chaque ligne.\n\n« Prévu » compte l’argent que vous attendez. « Prudent » fait comme s’il n’arrivait pas : si vous tenez dans la vue Prudent, vous êtes tranquille.\n\nQuand votre paie arrive, touchez-la et choisissez « Reçu ».',
  },
  dettes: {
    titre: 'Les dettes',
    texte: '« Je dois » : l’argent que vous devez à quelqu’un. « On me doit » : l’argent qu’on vous doit.\n\nChaque fois que vous remboursez (ou qu’on vous rembourse), touchez la dette puis « Noter un remboursement » : le reste se met à jour tout seul. Les crédits de banque ou de microfinance sont dans Plus › Crédits.',
  },
  epargne: {
    titre: 'L’épargne',
    texte: 'Le coussin de sécurité, c’est de l’argent pour les coups durs (maladie, panne, perte de travail) : l’idéal est 3 mois de factures.\n\nVous pouvez aussi créer des objectifs (moto, mariage, rentrée…). L’application calcule combien mettre de côté et quand. Chaque fois que vous le faites, touchez « Ajouter un versement ».',
  },
  sante: {
    titre: 'Votre note sur 100',
    texte: 'Cinq points notés sur 20 : ce que vous mettez de côté, vos dettes, votre coussin de sécurité, le poids de vos factures fixes, et la régularité de vos rentrées.\n\nEn dessous, les conseils sont classés du plus urgent au moins urgent : commencez par le premier.',
  },
} as const;

export type AideKey = keyof typeof AIDE;

/** Petit « ? » qui ouvre une explication. */
export function Aide({ k, size = 22 }: { k: AideKey; size?: number }) {
  const [open, setOpen] = useState(false);
  const a = AIDE[k];
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={12} accessibilityRole="button" accessibilityLabel={`Explication : ${a.titre}`}>
        <Ionicons name="help-circle-outline" size={size} color={C.violet} />
      </Pressable>
      <Bulle visible={open} onClose={() => setOpen(false)} titre={a.titre} texte={a.texte} />
    </>
  );
}

function Bulle({ visible, onClose, titre, texte, footer }: { visible: boolean; onClose(): void; titre: string; texte: string; footer?: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(30,24,59,0.55)', justifyContent: 'center', padding: 20 }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: C.carte, borderRadius: 22, padding: 22, gap: 14 }} accessibilityViewIsModal>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="bulb-outline" size={24} color={C.violet} />
            <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: C.texte }} accessibilityRole="header">{titre}</Text>
          </View>
          <Text style={{ fontSize: 16, lineHeight: 23, color: C.texte }}>{texte}</Text>
          {footer ?? (
            <Pressable onPress={onClose} accessibilityRole="button" style={{ backgroundColor: C.violet, borderRadius: 14, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>J’ai compris</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ETAPES: { icon: keyof typeof Ionicons.glyphMap; titre: string; texte: string }[] = [
  { icon: 'hand-left-outline', titre: 'Bienvenue !', texte: 'Mes Finances vous aide à décider AVANT de dépenser. En échange de quelques secondes par jour, elle vous dit combien vous pouvez dépenser sans vous mettre en difficulté.\n\nVoici les 6 choses à savoir.' },
  { icon: 'cash-outline', titre: '1. Le chiffre du jour', texte: 'En haut de l’accueil, « Je peux dépenser aujourd’hui » : c’est votre limite du jour, factures déjà mises de côté. Regardez-le chaque matin.' },
  { icon: 'add-circle-outline', titre: '2. Notez tout, même 500 F', texte: 'Bouton « Ajouter » :\n• « Dépense » quand vous payez quelque chose ;\n• « Revenu » › « Petite somme » quand vous recevez de l’argent.\n\nC’est le geste le plus important : c’est ainsi que l’on voit où partent les petites coupures.' },
  { icon: 'help-circle-outline', titre: '3. Avant d’acheter', texte: 'Bouton « Tester un achat » : tapez le prix. L’application répond « Vous pouvez » ou « À reporter », et vous dit pourquoi.' },
  { icon: 'calendar-outline', titre: '4. Le calendrier', texte: 'Points verts : l’argent qui arrive. Points rouges : l’argent qui sort. Touchez un jour pour y ajouter une entrée ou une sortie que vous connaissez déjà.' },
  { icon: 'clipboard-outline', titre: '5. Mon plan du mois', texte: 'Plus bas sur l’accueil : combien mettre de côté, quel jour, et combien dépenser par jour. Suivez les étapes numérotées.' },
  { icon: 'help-buoy-outline', titre: '6. Un doute ? Touchez « ? »', texte: 'Partout où vous voyez un petit « ? » violet, touchez-le pour une explication simple.\n\nVous pouvez revoir cette visite dans Plus › Revoir la visite guidée.' },
];

/** Visite guidée en quelques cartes, montrée à la première ouverture. */
export function VisiteGuidee({ visible, onClose }: { visible: boolean; onClose(): void }) {
  const [i, setI] = useState(0);
  const e = ETAPES[i];
  const last = i === ETAPES.length - 1;
  const close = () => { setI(0); onClose(); };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(30,24,59,0.6)', justifyContent: 'center', padding: 20 }}>
        <View style={{ backgroundColor: C.carte, borderRadius: 24, padding: 24, gap: 16 }} accessibilityViewIsModal>
          <View style={{ alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: C.violetClair, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={e.icon} size={38} color={C.violet} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: C.texte, textAlign: 'center' }} accessibilityRole="header">{e.titre}</Text>
          <Text style={{ fontSize: 16, lineHeight: 23, color: C.texte }}>{e.texte}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }} accessibilityLabel={`Étape ${i + 1} sur ${ETAPES.length}`}>
            {ETAPES.map((_, j) => (
              <View key={j} style={{ width: j === i ? 18 : 8, height: 8, borderRadius: 4, backgroundColor: j === i ? C.violet : C.lavande }} />
            ))}
          </View>
          <Pressable onPress={() => (last ? close() : setI(i + 1))} accessibilityRole="button"
            style={{ backgroundColor: C.violet, borderRadius: 14, padding: 15, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>{last ? 'C’est parti !' : 'Suivant'}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Pressable onPress={() => setI(Math.max(0, i - 1))} disabled={i === 0} accessibilityRole="button" hitSlop={10}>
              <Text style={{ color: i === 0 ? 'transparent' : C.violet, fontWeight: '700', fontSize: 15 }}>‹ Retour</Text>
            </Pressable>
            {!last ? (
              <Pressable onPress={close} accessibilityRole="button" hitSlop={10}>
                <Text style={{ color: C.secondaire, fontWeight: '600', fontSize: 15 }}>Passer</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
