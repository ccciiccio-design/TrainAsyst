import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
/* ===== 1. CONFIGURAZIONE SUPABASE ===== */
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// Usiamo variabili diverse per evitare conflitti di cache
const S_URL = 'https://orqgstmwfiachzkzbgmk.supabase.co'.trim();
const S_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ycWdzdG13ZmlhY2h6a3piZ21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NzEzNDgsImV4cCI6MjA5MzE0NzM0OH0.wA53JFyLznepo4DPZi0ydO5VQOm1Bhr_z_hAQHAxruY'.trim();

const supabase = createClient(S_URL, S_KEY);

const LOGO_URL =
'https://orqgstmwfiachzkzbgmk.supabase.co/storage/v1/object/sign/logo/New%20Logo%20sfondo%20trasp.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9lZWE4ZDM4ZC05MDc0LTQxYjYtYWVkZC1lM2QwYTNjOTFkMDIiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJsb2dvL05ldyBMb2dvIHNmb25kbyB0cmFzcC5wbmciLCJpYXQiOjE3Nzc2NjQ4MTgsImV4cCI6NDg5OTcyODgxOH0.HOVHDT_avz6j6t9Nxp5_cGT-fXxnqAW_zhMmacCqSs0';

const TABS = {
  HOME: 'HOME',
  CLIENTS: 'CLIENTS',
  SESSIONS: 'SESSIONS',
  PAYMENTS: 'PAYMENTS',
  ACCOUNTING: 'ACCOUNTING',
  DETAILS: 'DETAILS',
};
const downloadCSV = (csvContent, fileName) => {
  if (Platform.OS !== 'web') {
    Alert.alert("Export", "L'esportazione CSV è ottimizzata per la versione Web.");
    return;
  }
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const handleExportAccounting = (payments, expenses) => {
  let csv = "REPORT MOVIMENTI CASSA\n\n";
  csv += "Data;Tipo;Descrizione;Metodo;Entrata;Uscita\n";

  payments.forEach(p => {
    csv += `${new Date(p.created_at).toLocaleDateString()};ENTRATA;${p.nome_atleta || 'Atleta'};${p.method};${p.amount};0\n`;
  });

  expenses.forEach(e => {
    csv += `${new Date(e.expense_date).toLocaleDateString()};USCITA;${e.description};N/D;0;${e.amount}\n`;
  });
  
  downloadCSV(csv, `Bilancio_MVTrainer.csv`);
};

export default function App() {
  const [initialProfileTab, setInitialProfileTab] = useState('PANORAMICA');
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS.HOME);
  const [selectedClient, setSelectedClient] = useState(null);
  const [filterZeroClients, setFilterZeroClients] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isQuickPaymentModalVisible, setIsQuickPaymentModalVisible] = useState(false);
const [paymentSearchQuery, setPaymentSearchQuery] = useState('');
const handleQuickPaymentSelect = (client) => {
  setInitialProfileTab('PAGAMENTI'); // Diciamo al profilo di aprirsi sui pagamenti
  setSelectedClient(client);        // Carichiamo i dati dell'atleta
  setActiveTab(TABS.DETAILS);       // <--- FORZIAMO l'ingresso diretto nella scheda
  setIsQuickPaymentModalVisible(false);
  setPaymentSearchQuery('');
};
  const [showAddPackage, setShowAddPackage] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);


  const fetchData = async () => {
    if (!session?.user) return;
    setLoading(true);

    try {
      // 1. Caricamento Clienti
      const { data: cData, error: cError } = await supabase
        .from('clients')
        .select(`*, subscriptions(*), workouts(*), payments(*)`)
        .order('nome_cliente');

      if (cError) throw cError;

      setClients(cData || []);

      // Aggiornamento cliente selezionato (per refresh automatico saldo)
      if (selectedClient) {
        const updatedClient = cData.find(c => c.id === selectedClient.id);
        if (updatedClient) {
          setSelectedClient({ ...updatedClient }); 
        }
      }
      const { data: eData } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false });
if (eData) setExpenses(eData);
      // 2. Caricamento Sedute (Workouts) con dati dei Clienti
      const { data: wData, error: wError } = await supabase
        .from('workouts')
        .select(`
          *,
          clients (
            nome_cliente,
            subscriptions (sessions_remaining)
          )
        `)
        .order('created_at', { ascending: false });

      if (wError) throw wError; // Ora wError è definito correttamente

      setWorkouts(wData || []);

    } catch (e) {
      console.error('FETCH ERROR:', e);
      Alert.alert('Errore caricamento', e.message);
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (session) fetchData();
  }, [session]);

  if (loading && !session)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6D28D9" />
      </View>
    );
  if (!session) return <AuthScreen />;

const handleScaleSession = async (client) => {
  const today = new Date().toISOString().split('T')[0];

  // 1. Prendi la subscription attiva
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('client_id', client.id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!subs || subs.length === 0) return;
  const activeSub = subs[0];

  // Blocco se le sessioni sono finite
  if (activeSub.sessions_remaining <= 0) return;

  // --- CALCOLO ORARIO LOCALE (Fix 2 ore) ---
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000; // Offset in millisecondi
  const localISOTime = new Date(now.getTime() - offset).toISOString();

  try {
    // 2. Inserimento Seduta (Workouts)
    const { error: errorW } = await supabase // Definiamo errorW
      .from('workouts')
      .insert([
        {
          client_id: client.id,
                   created_at: localISOTime, // Usiamo l'ora locale calcolata sopra
          workout_date: today,
        },
      ]);

    if (errorW) {
      Alert.alert("Errore inserimento", errorW.message);
      return;
    }

    // 3. Scaliamo la sessione dalla subscription
    const { error: errorS } = await supabase
      .from('subscriptions')
      .update({ sessions_remaining: activeSub.sessions_remaining - 1 })
      .eq('id', activeSub.id);

    if (errorS) {
      Alert.alert("Errore aggiornamento pacchetto", errorS.message);
      return;
    }

    // Se tutto va bene, rinfresca i dati
    fetchData();
    Alert.alert("Successo", "Seduta registrata correttamente");

  } catch (err) {
    console.error("Errore generico:", err);
  }
};

  return (
    <SafeAreaView style={styles.app}>
      <View style={styles.content}>
      <Image 
  source={{ uri: LOGO_URL }} 
  style={[StyleSheet.absoluteFill, { opacity: 0.05, width: '100%', height: '100%' }]} 
  resizeMode="contain" 
/>
        {activeTab === TABS.HOME && (
          <HomeScreen
            clients={clients}
            workouts={workouts}
            onGoClientsZero={() => {
              setFilterZeroClients(true);
              setActiveTab(TABS.CLIENTS);
            }}
            onAddSession={() => setActiveTab(TABS.CLIENTS)}
            onAddClient={() => setShowAddClient(true)}
            onLogout={() => supabase.auth.signOut()}
            onNewPayment={() => setIsQuickPaymentModalVisible(true)}
          />
        )}
        {activeTab === TABS.CLIENTS && (
          <ClientsScreen
            clients={clients}
            filterZero={filterZeroClients}
            onAction={handleScaleSession}
            onSelect={(c) => {
              setSelectedClient(c);
              setActiveTab(TABS.DETAILS);
            }}
          />
        )}
        {activeTab === TABS.SESSIONS && (
  <SessionsScreen workouts={workouts} />
)}
    {activeTab === TABS.PAYMENTS && (
  <PaymentsScreen clients={clients} />
)}
{activeTab === TABS.ACCOUNTING && (
  <AccountingScreen 
    clients={clients} 
    expenses={expenses} 
    fetchData={fetchData} 
  />
)}
        {activeTab === TABS.DETAILS && (
  <ClientDetailsScreen
    client={selectedClient}
    initialTab={initialProfileTab} // Assicurati che questa riga ci sia!
    onBack={() => {
      setActiveTab(TABS.CLIENTS);
      setSelectedClient(null);
      setInitialProfileTab('PANORAMICA');
    }}
    fetchData={fetchData}
    session={session}
  />
)}
        {/* Placeholder per i tab ancora non sviluppati */}
        
      </View>

      {activeTab !== TABS.DETAILS && (
        <BottomBar
          activeTab={activeTab}
          onChange={(t) => {
            setFilterZeroClients(false);
            setActiveTab(t);
          }}
        />
      )}

      <AddClientModal
        visible={showAddClient}
        onClose={() => setShowAddClient(false)}
        onSuccess={() => {
          setShowAddClient(false);
          fetchData();
        }}
      />
{/* MODAL RICERCA RAPIDA PER PAGAMENTO */}
<Modal visible={isQuickPaymentModalVisible} animationType="slide" transparent={true}>
  <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
    <View style={{ backgroundColor: '#FFF', borderTopLeftRadius: 25, borderTopRightRadius: 25, height: '80%', padding: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Seleziona Atleta</Text>
        <TouchableOpacity onPress={() => setIsQuickPaymentModalVisible(false)}>
          <Text style={{ color: '#6D28D9', fontWeight: 'bold' }}>Chiudi</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={[styles.input, { marginBottom: 15 }]}
        placeholder="Cerca atleta per nome..."
        value={paymentSearchQuery}
        onChangeText={setPaymentSearchQuery}
      />

      <ScrollView>
        {clients
          .filter(c => c.nome_cliente.toLowerCase().includes(paymentSearchQuery.toLowerCase()))
          .map(client => (
            <TouchableOpacity 
              key={client.id} 
              style={{ padding: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between' }}
              onPress={() => handleQuickPaymentSelect(client)}
            >
              <Text style={{ fontSize: 16, fontWeight: '500' }}>{client.nome_cliente}</Text>
              <Text style={{ color: '#6D28D9' }}>Seleziona ➔</Text>
            </TouchableOpacity>
          ))}
      </ScrollView>
    </View>
  </View>
</Modal>
     
    </SafeAreaView>
  );
}

/* ===== 2. AUTH SCREEN ===== */
function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  async function handleAuth() {
    setLoading(true);
    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    if (error) Alert.alert('Errore', error.message);
    setLoading(false);
  }

  return (
    <View style={[styles.center, { padding: 30, backgroundColor: '#FFF' }]}>
      <Image
        source={{ uri: LOGO_URL }}
        style={{ width: 120, height: 120, marginBottom: 20 }}
        resizeMode="contain"
      />
      <TextInput
        style={styles.inputAuth}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.inputAuth}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TouchableOpacity style={styles.saveBtn} onPress={handleAuth}>
        <Text style={styles.saveBtnText}>
          {isSignUp ? 'Crea Account' : 'Accedi'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setIsSignUp(!isSignUp)}
        style={{ marginTop: 20 }}>
        <Text style={{ color: '#6D28D9' }}>
          {isSignUp ? 'Vai al Login' : 'Non hai un account? Registrati'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ===== 3. HOME SCREEN ===== */
function HomeScreen({
  clients,
  workouts,
  onGoClientsZero,
  onAddSession,
  onAddClient,
  onLogout,
  onNewPayment, 
}) {
  // --- LOGICA CALCOLI ---
  const oggi = new Date();
  const inizioMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
  const nomeMese = oggi.toLocaleDateString('it-IT', { month: 'long' });

  // 1. Calcolo DA INCASSARE
  const totalDebt = clients.reduce((acc, client) => {
    const sub = (client.subscriptions || [])
      .slice()
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || {};
    const saldo = (sub.total_price || 0) - (sub.total_paid || 0);
    return acc + (saldo > 0 ? saldo : 0);
  }, 0);

  // 2. Calcolo INCASSATO MESE
  const incassatoMese = clients.flatMap(c => c.payments || [])
    .filter(p => new Date(p.created_at) >= inizioMese)
    .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // 3. Calcolo VOLUME LAVORO (Sedute mese)
  const seduteMese = workouts.filter(w => new Date(w.workout_date) >= inizioMese).length;

  return (
    <View style={styles.homeContainer}>
      <View style={styles.headerRow}>
        <Image source={{ uri: LOGO_URL }} style={styles.logoSmall} resizeMode="contain" />
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logoutText}>Esci</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.welcome}>Benvenuto, Nico</Text>
      <Text style={styles.dateText}>
        {oggi.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}
      </Text>

      {/* GRID KPI */}
      <View style={styles.kpiGrid}>
        <KpiCard label="Clienti attivi" value={clients.filter(c => c.is_active !== false).length}/>
        <KpiCard label="Sedute mese" value={seduteMese} color="#6D28D9" />
        <KpiCard label="Da incassare" value={`€${totalDebt.toFixed(0)}`} color="#EF4444" />
        <KpiCard label={`Incassato ${nomeMese}`} value={`€${incassatoMese.toFixed(0)}`} color="#22C55E" />
      </View>

      <TouchableOpacity style={styles.actionBox} onPress={onGoClientsZero}>
        <Text style={styles.actionBoxText}>
          ⚠️ Clienti con sessioni terminate
        </Text>
      </TouchableOpacity>

      <View style={styles.quickActionsRow}>
        <QuickBtn label="Nuovo Cliente" icon="👤" onPress={onAddClient} />
        <QuickBtn label="Nuova Sessione" icon="💪" onPress={onAddSession} />
        <QuickBtn label="Nuovo Pagamento"icon="💰" onPress={onNewPayment} 
        />
      </View>
    </View>
  );
}/* ====== DATA SELECTOR*/
function DateSelector({ value, onChange, color = '#6D28D9' }) {
  const [show, setShow] = React.useState(false);

  // Forza il valore a essere un oggetto Date
  const safeDate = value instanceof Date ? value : new Date(value);

  if (Platform.OS === 'web') {
    return (
      <input
        type="date"
        // Usa safeDate per evitare l'errore .toISOString
        value={safeDate.toISOString().split('T')[0]}
        onChange={(e) => {
          const newD = new Date(e.target.value);
          if (!isNaN(newD)) onChange(newD);
        }}
        style={{
          padding: '10px',
          borderRadius: '12px',
          border: `2px solid ${color}`,
          backgroundColor: '#FFF',
          color: color,
          fontWeight: 'bold',
          flex: 1,
          textAlign: 'center',
          outline: 'none'
        }}
      />
    );
  }

  return (
    <>
      <TouchableOpacity 
        onPress={() => setShow(true)} 
        style={[styles.toggleBtn, { backgroundColor: color, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }]}
      >
        <Text style={{ color: '#FFF', fontWeight: 'bold' }}>
          📅 {safeDate.toLocaleDateString('it-IT')}
        </Text>
      </TouchableOpacity>

      {show && (
        <DateTimePicker
          value={safeDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, selectedDate) => {
            setShow(false);
            if (selectedDate) onChange(selectedDate);
          }}
        />
      )}
    </>
  );
}
/* ===== 4. ADD CLIENT MODAL (COMPLETA) ===== */
function AddClientModal({ visible, onClose, onSuccess }) {
  const [nome, setNome] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [sessions, setSessions] = useState('');
  const [price, setPrice] = useState('');
  const [acconto, setAcconto] = useState('');
  const [method, setMethod] = useState('Cash');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!nome.trim()) return Alert.alert('Errore', 'Nome obbligatorio');

    // Recuperiamo l'ID del Trainer loggato
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return Alert.alert(
        'Errore',
        'Sessione scaduta. Effettua di nuovo il login.'
      );

    setIsSaving(true);
    try {
      const tot = Number(price) || 0;
      const acc = Number(acconto) || 0;

      // 1. CREAZIONE CLIENTE (con user_id del trainer)
      const { data: nC, error: cE } = await supabase
        .from('clients')
        .insert([
          {
            nome_cliente: nome,
            tel: telefono,
            email,
            notes: note,
            saldo: tot,
            user_id: user.id, // <--- FONDAMENTALE: Lega l'atleta a te
          },
        ])
        .select()
        .single();

      if (cE) throw cE;

      // 2. CREAZIONE ABBONAMENTO
      if (tot > 0) {
        const { data: nS, error: sE } = await supabase
          .from('subscriptions')
          .insert([
            {
              client_id: nC.id,
              total_sessions: parseInt(sessions) || 0,
              sessions_remaining: parseInt(sessions) || 0,
              total_price: tot,
              total_paid: 0,
              //user_id: user.id, // <--- Lega anche l'abbonamento
            },
          ])
          .select()
          .single();

       if (sE) throw sE;

      // 3. REGISTRAZIONE PAGAMENTO (Usa questo blocco che è quello corretto)
      if (parseFloat(acc) > 0) {
        const { error: pE } = await supabase.from('payments').insert([
          {
            client_id: nC.id,        // nC è il cliente appena creato
            subscription_id: nS.id,  // nS è l'abbonamento appena creato
            amount: parseFloat(acc),             // acc è l'acconto inserito
            method: method,
            //nome_atleta: nC.nome_cliente, // Prende il nome correttamente
            //user_id: user.id,
            //note: 'Acconto iscrizione',
          },
        ]);
        if (pE) throw pE;
      }
      }

      // Reset campi e chiusura
      setNome('');
      setTelefono('');
      setEmail('');
      setNote('');
      setSessions('');
      setPrice('');
      setAcconto('');
      onSuccess();
      Alert.alert('Successo', 'Atleta creato correttamente!');
    } catch (e) {
      console.error('Errore salvataggio:', e);
      Alert.alert('Errore DB', e.message);
    }
    setIsSaving(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuova Scheda Atleta</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 30 }}>×</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.inputLabel}>Nome e Cognome *</Text>
            <TextInput
              style={styles.input}
              placeholder="Inserisci nominativo"
              value={nome}
              onChangeText={setNome}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Telefono</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="phone-pad"
                  value={telefono}
                  onChangeText={setTelefono}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <Text style={styles.modalSubtitle}>Configurazione Pacchetto</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Sessioni</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={sessions}
                  onChangeText={setSessions}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.inputLabel}>Prezzo Totale (€)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Acconto (€)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: '#F0FDF4' }]}
                  keyboardType="numeric"
                  value={acconto}
                  onChangeText={setAcconto}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.inputLabel}>Metodo</Text>
                <View style={styles.methodSelector}>
                  {['Cash', 'Bonif.'].map((m) => (
                    <TouchableOpacity
                      key={m}
                      onPress={() => setMethod(m)}
                      style={[
                        styles.methodBtn,
                        method === m && styles.methodBtnActive,
                      ]}>
                      <Text
                        style={{
                          fontSize: 10,
                          color: method === m ? '#FFF' : '#000',
                        }}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <Text style={styles.inputLabel}>Note / Obiettivi</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              multiline
              value={note}
              onChangeText={setNote}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              {isSaving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.saveBtnText}>Crea Atleta</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
/* ===== ADD PACKAGE MODAL ===== */

function AddPackageModal({ visible, client, onClose, onSuccess, user }) {
  // 1️⃣ STATE
  const [sessions, setSessions] = useState('');
  const [price, setPrice] = useState('');
  const [acconto, setAcconto] = useState('');
  const [method, setMethod] = useState('Cash');
  const [loading, setLoading] = useState(false);

  // 2️⃣ 👉 QUI VA handleSave
  const handleSave = async () => {
    if (loading) return;
  setLoading(true);
  try {
    const sessionsNum = parseInt(sessions);
    const total = Number(price) || 0;
    const paid = Number(acconto) || 0;

    if (isNaN(sessionsNum) || sessionsNum <= 0) {
      return Alert.alert('Errore', 'Numero sedute non valido');
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Alert.alert('Errore', 'Sessione scaduta');

    // 1️⃣ Nuovo pacchetto
    const { data: sub, error } = await supabase
      .from('subscriptions')
      .insert([
        {
          client_id: client.id,
          total_sessions: sessionsNum,
          sessions_remaining: sessionsNum,
          total_price: total,
          total_paid: 0,
        },
      ])
      .select()
      .single();

    if (error) {
      console.log('ERRORE INSERT PACCHETTO', error);
      Alert.alert('Errore', JSON.stringify(error));
      return;
    }

    // 2️⃣ Pagamento (solo se acconto)
    if (parseFloat(paid) > 0) {
      const { error: paymentError } = await supabase.from('payments').insert([
        {
          client_id: client.id,
          subscription_id: sub.id,
          amount: parseFloat(paid),
          method: method, // Usiamo lo stato 'method' già presente nel modal
          //user_id: user.id,
          payment_date: new Date().toISOString().split('T')[0], // Data odierna
          // NON aggiungere nome_atleta qui perché causerebbe l'errore 400
        },
      ]);
      
      if (paymentError) {
    console.error("Errore inserimento riga pagamento:", paymentError.message);
    Alert.alert("Errore Pagamento", "Il pacchetto è stato creato ma l'acconto non è stato registrato.");
      }
    }

if (onSuccess) onSuccess();
onClose(); // Aggiungi onClose() se manca per chiudere il modal
  } catch (err) {
    Alert.alert("Errore", err.message);
  } finally {
    setLoading(false);
  }
};
  

  // 3️⃣ RETURN JSX
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* HEADER */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Nuovo pacchetto</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={{ fontSize: 28 }}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* SEDUTE */}
            <Text style={styles.inputLabel}>Sedute</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder=""
              value={sessions}
              onChangeText={setSessions}
            />

            {/* IMPORTO */}
            <Text style={styles.inputLabel}>Importo totale (€)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder=""
              value={price}
              onChangeText={setPrice}
            />

            {/* ACCONTO */}
            <Text style={styles.inputLabel}>Acconto (€)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: '#F0FDF4' }]}
              keyboardType="numeric"
              placeholder=""
              value={acconto}
              onChangeText={setAcconto}
            />

            {/* METODO */}
            <Text style={styles.inputLabel}>Metodo di pagamento</Text>
            <View style={styles.methodSelector}>
              {['Cash', 'Bonif.'].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => setMethod(m)}
                  style={[
                    styles.methodBtn,
                    method === m && styles.methodBtnActive,
                  ]}>
                  <Text
                    style={{
                      fontSize: 12,
                      color: method === m ? '#FFF' : '#000',
                    }}>
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* CTA */}
            <TouchableOpacity 
  style={[styles.saveBtn, { opacity: loading || !sessions || !price ? 0.7 : 1 }]} 
  disabled={loading || !sessions || !price}
  onPress={handleSave}
>
  {loading ? (
    <ActivityIndicator color="#FFF" />
  ) : (
    <Text style={styles.saveBtnText}>
      {sessions && price ? 'Salva Pacchetto' : 'Inserisci i dati...'}
    </Text>
  )}
</TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
/* ===== 5. ALTRI COMPONENTI (CLIENTS, DETAILS, BOTTOMBAR) ===== */
function SessionsScreen({ workouts }) {
  // 1. Usiamo un oggetto Date come stato iniziale
  const [selectedDate, setSelectedDate] = useState(new Date());

  // 2. Trasformiamo l'oggetto Date in stringa YYYY-MM-DD per filtrare i workout
  const dateString = selectedDate.toISOString().split('T')[0];
  
  // 3. Filtriamo i workout usando la stringa ottenuta
  const filteredWorkouts = workouts.filter(w => w.workout_date === dateString);
  const totaleGiorno = filteredWorkouts.length;

  return (
       <View style={styles.clientsWrapper}>
    <Image 
  source={{ uri: LOGO_URL }} 
  style={[StyleSheet.absoluteFill, { opacity: 0.05, width: '100%', height: '100%' }]} 
  resizeMode="contain" 
/>
      
      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <Text style={styles.sectionTitle}>Registro Sedute</Text>
        <View style={styles.toggleContainer}>
          {/* USIAMO IL NUOVO SELETTORE (Passo 1) */}
          <DateSelector 
            value={selectedDate} 
            onChange={setSelectedDate} 
            color="#6D28D9" 
          />
            <TouchableOpacity 
            style={[styles.toggleBtn, { flex: 0.4, marginLeft: 8, backgroundColor: '#EDE9FE' }]}
            onPress={() => setSelectedDate(new Date())}
          >
            <Text style={{ color: '#6D28D9', fontWeight: 'bold', textAlign: 'center' }}>Oggi</Text>
          </TouchableOpacity>
        </View>

        {/* BOX TOTALE SESSIONI */}
        <View style={{ 
          backgroundColor: '#FFF', 
          padding: 15, 
          borderRadius: 15, 
          marginBottom: 20, 
          elevation: 3, 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#E9E7FF' 
        }}>
          <Text style={{ fontWeight: 'bold', color: '#6B7280' }}>Sessioni del giorno:</Text>
          <View style={{ backgroundColor: '#6D28D9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#FFF' }}>{totaleGiorno}</Text>
          </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 150, flexGrow: 1 }}>
        {filteredWorkouts.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Nessuna seduta registrata.</Text>
        ) : (
          filteredWorkouts.map((w) => (
            <View key={w.id} style={[styles.clientCard, { borderLeftWidth: 4, borderLeftColor: '#6D28D9' }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{w.clients?.nome_cliente}</Text>
                {/*<Text style={{ color: '#6B7280', fontSize: 12 }}>🕒 {new Date(w.created_at).toLocaleTimeString('it-IT', {hour: '2-digit',minute: '2-digit',hour12: false})}</Text>*/}
                <Text style={{ color: '#6B7280', fontSize: 12 }}>
  🕒 {(() => {
    const d = new Date(w.created_at);
    // Se vedi ancora l'ora indietro, aggiungiamo manualmente le 2 ore
    // ma solo se il timestamp viene dal DB come UTC
    const ore = d.getHours();
    const minuti = d.getMinutes().toString().padStart(2, '0');
    return `${ore}:${minuti}`;
  })()}
</Text>
              </View>
              <View style={{ backgroundColor: '#F3E8FF', padding: 10, borderRadius: 12 }}>
                <Text style={{ color: '#6D28D9', fontWeight: 'bold' }}>
                  {w.clients?.subscriptions?.[0]?.sessions_remaining ?? 0} residui
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
function PaymentsScreen({ clients }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const allPayments = clients.flatMap(client => 
    (client.payments || []).map(p => ({
      ...p,
      nome_atleta: client.nome_cliente
    }))
  );
  const dateString = selectedDate.toISOString().split('T')[0];
  const filteredPayments = allPayments.filter(p => {
    const pDate = p.created_at ? p.created_at.split('T')[0] : '';
    return pDate === dateString;
  });
  const totaleGiorno = filteredPayments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  return (
      <View style={styles.clientsWrapper}>
    <Image 
  source={{ uri: LOGO_URL }} 
  style={[StyleSheet.absoluteFill, { opacity: 0.05, width: '100%', height: '100%' }]} 
  resizeMode="contain" 
/>

      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <Text style={styles.sectionTitle}>Registro Pagamenti</Text>
        
        <View style={styles.toggleContainer}>
          <DateSelector 
            value={selectedDate} 
            onChange={setSelectedDate} 
            color="#22C55E" 
          />
          <TouchableOpacity 
            style={[styles.toggleBtn, { flex: 0.4, marginLeft: 8, backgroundColor: '#DCFCE7' }]}
            onPress={() => setSelectedDate(new Date())}
          >
            <Text style={{ color: '#166534', fontWeight: 'bold', textAlign: 'center' }}>Oggi</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCardGreen}>
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', color: '#6B7280' }}>Totale Incassato:</Text>
              <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#22C55E' }}>{`€ ${totaleGiorno}`}</Text>
           </View>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 150}}>
        {filteredPayments.length === 0 ? (
          <Text style={{ textAlign: 'center', color: '#9CA3AF', marginTop: 40 }}>Nessun incasso in questa data.</Text>
        ) : (
          filteredPayments.map((p) => (
            <View key={p.id} style={[styles.clientCard, { borderLeftColor: '#22C55E', borderLeftWidth: 5 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{String(p.nome_atleta)}</Text>
                <Text style={{ color: '#6B7280', fontSize: 12 }}>{String(p.method || 'N/D')}</Text>
              </View>
              <Text style={{ color: '#22C55E', fontWeight: 'bold', fontSize: 18 }}>{`+ €${p.amount}`}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
function AccountingScreen({ clients, expenses, fetchData }) {
  const [selectedMonths, setSelectedMonths] = useState([new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isExpenseModalVisible, setIsExpenseModalVisible] = useState(false);
  const [isHistoryModalVisible, setIsHistoryModalVisible] = useState(false);
  
  // Stati per la nuova uscita o modifica
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date());
  const [editingExpenseId, setEditingExpenseId] = useState(null); // NUOVO: per gestire la modifica

  const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
  const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - 2 + i);

  // --- LOGICA DI CALCOLO ---
  const allPayments = clients.flatMap(c => (c.payments || []));
  
  const filteredPayments = allPayments.filter(p => {
    const pDate = new Date(p.created_at);
    return selectedMonths.includes(pDate.getMonth()) && pDate.getFullYear() === selectedYear;
  });

  const filteredExpenses = expenses.filter(e => {
    const eDate = new Date(e.expense_date);
    return selectedMonths.includes(eDate.getMonth()) && eDate.getFullYear() === selectedYear;
  });

  const totalIn = filteredPayments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalOut = filteredExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const net = totalIn - totalOut;

  const toggleMonth = (index) => {
    if (selectedMonths.includes(index)) {
      if (selectedMonths.length > 1) {
        setSelectedMonths(selectedMonths.filter(m => m !== index));
      }
    } else {
      setSelectedMonths([...selectedMonths, index]);
    }
  };

  // NUOVO: Funzione per preparare la modifica
  const prepareEdit = (exp) => {
    setDesc(exp.description);
    setAmount(exp.amount.toString());
    setExpDate(new Date(exp.expense_date));
    setEditingExpenseId(exp.id);
    setIsExpenseModalVisible(true);
  };

  // NUOVO: Funzione per eliminare spesa
  const handleDeleteExpense = async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (!error) fetchData();
  };

  const handleAddExpense = async () => {
    if (!desc || !amount) {
      alert("Inserisci descrizione e importo");
      return;
    }

    const expenseData = {
      description: desc,
      amount: parseFloat(amount.replace(',', '.')),
      expense_date: expDate.toISOString().split('T')[0],
      category: 'Generale'
    };

    let error;
    if (editingExpenseId) {
      // MODIFICA esistente
      const { error: err } = await supabase.from('expenses').update(expenseData).eq('id', editingExpenseId);
      error = err;
    } else {
      // INSERIMENTO nuovo
      const { error: err } = await supabase.from('expenses').insert([expenseData]);
      error = err;
    }

    if (!error) {
      setDesc('');
      setAmount('');
      setExpDate(new Date());
      setEditingExpenseId(null);
      setIsExpenseModalVisible(false);
      fetchData(); 
    }
  };
// Uniamo entrate e uscite in un unico flusso
const cashFlow = [
  ...filteredPayments.map(p => ({
    id: p.id,
    type: 'IN',
    label: clients.find(c => c.id === p.client_id)?.nome_cliente || 'Entrata',
    amount: p.amount,
    date: p.created_at,
    detail: p.method
  })),
  ...filteredExpenses.map(e => ({
    id: e.id,
    type: 'OUT',
    label: e.description,
    amount: e.amount,
    date: e.expense_date,
    detail: 'Uscita Spesa'
  }))
].sort((a, b) => new Date(b.date) - new Date(a.date)); // Ordina per data decrescente
  return (
      <View style={styles.clientsWrapper}>
    <Image 
  source={{ uri: LOGO_URL }} 
  style={[StyleSheet.absoluteFill, { opacity: 0.05, width: '100%', height: '100%' }]} 
  resizeMode="contain" 
/>
      
      {/* PUNTO 1: ScrollView con flex e paddingBottom per lo scroll infinito */}
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Bilancio Economico</Text>

        {/* SELETTORE ANNO */}
        <View style={{ flexDirection: 'row', marginBottom: 15, alignItems: 'center' }}>
          <Text style={{ marginRight: 10, fontWeight: 'bold', color: '#6B7280' }}>Anno:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {years.map(y => (
              <TouchableOpacity 
                key={y} 
                onPress={() => setSelectedYear(y)}
                style={[styles.accMonthChip, selectedYear === y && { backgroundColor: '#1F2937', borderColor: '#1F2937' }]}
              >
                <Text style={{ color: selectedYear === y ? '#FFF' : '#6B7280', fontWeight: 'bold' }}>{y}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* SELETTORE MESI */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {months.map((m, index) => (
            <TouchableOpacity 
              key={m} 
              onPress={() => toggleMonth(index)}
              style={[styles.accMonthChip, selectedMonths.includes(index) && { backgroundColor: '#6D28D9', borderColor: '#6D28D9' }]}
            >
              <Text style={{ color: selectedMonths.includes(index) ? '#FFF' : '#6B7280', fontWeight: 'bold' }}>{m}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* BOX KPI */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
          <View style={[styles.accKpiCard, { borderColor: '#22C55E' }]}>
            <Text style={styles.accKpiLabel}>ENTRATE</Text>
            <Text style={[styles.accKpiValue, { color: '#22C55E' }]}>€ {totalIn.toFixed(2)}</Text>
          </View>
          <View style={[styles.accKpiCard, { borderColor: '#EF4444' }]}>
            <Text style={styles.accKpiLabel}>USCITE</Text>
            <Text style={[styles.accKpiValue, { color: '#EF4444' }]}>€ {totalOut.toFixed(2)}</Text>
          </View>
        </View>

        {/* BOX UTILE NETTO */}
        <View style={{ width: '100%', backgroundColor: net >= 0 ? '#DCFCE7' : '#FEE2E2', borderRadius: 20, paddingVertical: 20, paddingHorizontal: 15, marginBottom: 20, alignItems: 'center', elevation: 3 }}>
           <Text style={[styles.accKpiLabel, { color: net >= 0 ? '#166534' : '#991B1B', marginBottom: 8 }]}>UTILE NETTO PERIODO</Text>
           <Text style={{ fontSize: 28, fontWeight: 'bold', color: net >= 0 ? '#166534' : '#991B1B' }}>€ {net.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</Text>
        </View>

        {/* GRAFICO */}
        <View style={{ backgroundColor: '#FFF', padding: 20, borderRadius: 25, marginBottom: 20, elevation: 2 }}>
          <Text style={[styles.accKpiLabel, { marginBottom: 20 }]}>ANDAMENTO MENSILE</Text>
          <View style={{ height: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' }}>
            {selectedMonths.sort((a, b) => a - b).map(mIndex => {
              const mIn = allPayments.filter(p => { const d = new Date(p.created_at); return d.getMonth() === mIndex && d.getFullYear() === selectedYear; }).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
              const mOut = expenses.filter(e => { const d = new Date(e.expense_date); return d.getMonth() === mIndex && d.getFullYear() === selectedYear; }).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
              const maxVal = Math.max(totalIn, totalOut) || 1;
              const heightIn = (mIn / maxVal) * 120;
              const heightOut = (mOut / maxVal) * 120;
              return (
                <View key={mIndex} style={{ alignItems: 'center', flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                    <View style={{ width: 10, height: Math.max(heightIn, 5), backgroundColor: '#22C55E', borderRadius: 4 }} />
                    <View style={{ width: 10, height: Math.max(heightOut, 5), backgroundColor: '#EF4444', borderRadius: 4 }} />
                  </View>
                  <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8 }}>{months[mIndex]}</Text>
                </View>
              );
            })}
          </View>
          <TouchableOpacity 
  style={styles.exportBtnMain} 
  onPress={() => handleExportAccounting(filteredPayments, filteredExpenses)}
>
  <Text style={styles.exportBtnText}>📥 Esporta Report (CSV)</Text>
</TouchableOpacity>
        </View>
<TouchableOpacity 
  style={{ alignSelf: 'center', marginVertical: 10 }}
  onPress={() => setIsHistoryModalVisible(true)}
>
  <Text style={{ color: '#6D28D9', fontWeight: 'bold', textDecorationLine: 'underline' }}>
    👁️ Vedi Cronologia Completa
  </Text>
</TouchableOpacity>
        <TouchableOpacity 
          style={[styles.saveBtn, { backgroundColor: '#EF4444' }]}
          onPress={() => { setEditingExpenseId(null); setDesc(''); setAmount(''); setIsExpenseModalVisible(true); }}
        >
          <Text style={styles.saveBtnText}>+ Nuova Uscita</Text>
        </TouchableOpacity>

        {/* LISTA USCITE CON MODIFICA E ELIMINAZIONE */}
        <Text style={[styles.sectionTitle, { marginTop: 30, fontSize: 16 }]}>Dettaglio Uscite</Text>
        {filteredExpenses.length === 0 ? (
          <Text style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Nessuna uscita registrata.</Text>
        ) : (
          filteredExpenses.map(exp => (
            <View key={exp.id} style={{ backgroundColor: '#FFF', padding: 15, borderRadius: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', elevation: 1 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: '#1F2937' }}>{exp.description}</Text>
                <Text style={{ fontSize: 11, color: '#6B7280' }}>{new Date(exp.expense_date).toLocaleDateString('it-IT')}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 16 }}>- €{exp.amount}</Text>
                <TouchableOpacity onPress={() => prepareEdit(exp)}>
                  <Text style={{ fontSize: 18 }}>✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDeleteExpense(exp.id)}>
                  <Text style={{ fontSize: 18 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
                          </View>
          ))
        
        )}
      </ScrollView>

      {/* MODAL USCITE */}
      <Modal visible={isExpenseModalVisible} animationType="fade" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFF', borderRadius: 25, padding: 25 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#EF4444' }}>
              {editingExpenseId ? "Modifica Spesa" : "Nuova Spesa"}
            </Text>
            <TextInput style={styles.input} value={desc} onChangeText={setDesc} placeholder="Descrizione" />
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="Importo €" />
            <DateSelector value={expDate} onChange={setExpDate} color="#EF4444" />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 30 }}>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: '#F3F4F6' }]} onPress={() => setIsExpenseModalVisible(false)}>
                <Text style={{ color: '#4B5563', fontWeight: 'bold' }}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: '#EF4444' }]} onPress={handleAddExpense}>
                <Text style={styles.saveBtnText}>Conferma</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* MODAL CRONOLOGIA COMPLETA */}
<Modal visible={isHistoryModalVisible} animationType="slide">
  <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
    <View style={{ padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Flusso di Cassa</Text>
      <TouchableOpacity onPress={() => setIsHistoryModalVisible(false)}>
        <Text style={{ color: '#6D28D9', fontWeight: 'bold' }}>Chiudi</Text>
      </TouchableOpacity>
    </View>

    <ScrollView contentContainerStyle={{ padding: 20 }}>
      {cashFlow.length === 0 ? (
        <Text style={{ textAlign: 'center', marginTop: 50, color: '#9CA3AF' }}>Nessun movimento nel periodo selezionato.</Text>
      ) : (
        cashFlow.map((item, index) => (
          <View 
            key={`${item.type}-${item.id}-${index}`} 
            style={{ 
              backgroundColor: '#FFF', 
              padding: 15, 
              borderRadius: 16, 
              marginBottom: 10, 
              flexDirection: 'row', 
              alignItems: 'center',
              borderLeftWidth: 5,
              borderLeftColor: item.type === 'IN' ? '#22C55E' : '#EF4444'
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 'bold', color: '#1F2937' }}>{item.label}</Text>
              <Text style={{ fontSize: 12, color: '#6B7280' }}>
                {new Date(item.date).toLocaleDateString('it-IT')} • {item.detail}
              </Text>
            </View>
            <Text style={{ 
              fontSize: 16, 
              fontWeight: 'bold', 
              color: item.type === 'IN' ? '#166534' : '#991B1B' 
            }}>
              {item.type === 'IN' ? '+' : '-'} €{item.amount}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  </SafeAreaView>
</Modal>
    </View>
  );
}
function ClientsScreen({ clients, filterZero, onAction, onSelect }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState('ATTIVI'); // 'ATTIVI' oppure 'ARCHIVIO'

  const filtered = clients.filter((c) => {
    const nome = (c.nome_cliente || '').toLowerCase();
    const matchesSearch = nome.includes(search.toLowerCase());
    
    // Logica filtro stato
    const isClientActive = c.is_active ?? true;
    const matchesStatus = view === 'ATTIVI' ? isClientActive : !isClientActive;

    // Se arriviamo dalla home per i "sessioni terminate", mostriamo solo quelli con 0 sedute
    if (filterZero) {
      const sessions = c.subscriptions?.[0]?.sessions_remaining || 0;
      return matchesSearch && matchesStatus && sessions === 0;
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <View style={styles.clientsWrapper}>
    <Image 
  source={{ uri: LOGO_URL }} 
  style={[StyleSheet.absoluteFill, { opacity: 0.05, width: '100%', height: '100%' }]} 
  resizeMode="contain" 
/>
      <Text style={styles.sectionTitle}>I Miei Atleti</Text>

      {/* SELETTORE ATTIVI / ARCHIVIO (Segmented Control) */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity 
          style={[styles.toggleBtn, view === 'ATTIVI' && styles.toggleBtnActive]} 
          onPress={() => setView('ATTIVI')}
        >
          <Text style={[styles.toggleText, view === 'ATTIVI' && styles.toggleTextActive]}>Attivi</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.toggleBtn, view === 'ARCHIVIO' && styles.toggleBtnActive]} 
          onPress={() => setView('ARCHIVIO')}
        >
          <Text style={[styles.toggleText, view === 'ARCHIVIO' && styles.toggleTextActive]}>Archivio</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Cerca per nome..."
        value={search}
        onChangeText={setSearch}
        placeholderTextColor="#9CA3AF"
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
        {filtered.length === 0 ? (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <Text style={{ color: '#9CA3AF' }}>Nessun atleta in questa lista</Text>
          </View>
        ) : (
          filtered.map((c) => (
            <TouchableOpacity key={c.id} style={styles.clientCard} onPress={() => onSelect(c)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.clientName}>{c.nome_cliente}</Text>
                <Text style={{ color: (c.subscriptions?.[0]?.sessions_remaining || 0) > 0 ? '#6D28D9' : '#EF4444', fontSize: 12 }}>
                  {c.subscriptions?.[0]?.sessions_remaining || 0} sedute rimanenti
                </Text>
              </View>
              {view === 'ATTIVI' && (
                <TouchableOpacity
                  style={[styles.plusBtn, (c.subscriptions?.[0]?.sessions_remaining || 0) <= 0 && { backgroundColor: '#9CA3AF' }]}
                  disabled={(c.subscriptions?.[0]?.sessions_remaining || 0) <= 0}
                  onPress={(e) => { e.stopPropagation(); onAction(c); }}
                >
                  <Text style={styles.plusBtnText}>+</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}
      

/* ===== 5. ALTRI COMPONENTI (CLIENTS, DETAILS, BOTTOMBAR) ===== */

function ClientDetailsScreen({ client, onBack, onAddPackage, fetchData, initialTab, session }) {
const [addPackageModal, setAddPackageModal] = useState(false);  
  const sub = client.subscriptions
    ?.slice()
    ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] || {};

  const [activeSheet, setActiveSheet] = useState(initialTab || 'PANORAMICA');
  const [workouts, setWorkouts] = useState([]);
 
  
  // STATI PER IL PROFILO (MODAL)
  const [isProfileModalVisible, setIsProfileModalVisible] = useState(false);
  const [editNome, setEditNome] = useState(client.nome_cliente);
  const [editTel, setEditTel] = useState(client.tel || '');
  const [editEmail, setEditEmail] = useState(client.email || '');
  const [isActive, setIsActive] = useState(client.is_active ?? true);

  // STATI PER PAGAMENTI
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('Cash');

  // STATO PER LE NOTE (SALVATAGGIO AUTOMATICO)
  const [notes, setNotes] = useState(client.notes || '');

  useEffect(() => {
    const loadWorkouts = async () => {
      const { data } = await supabase
        .from('workouts')
        .select('*')
        .eq('client_id', client.id)
        .order('workout_date', { ascending: false });
      setWorkouts(data || []);
    };
    loadWorkouts();
  }, [client]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (notes !== client.notes) {
        await supabase.from('clients').update({ notes: notes }).eq('id', client.id);
      }
    }, 1000);
    return () => clearTimeout(delayDebounceFn);
  }, [notes]);

  const handleUpdateProfile = async () => {
    const { error } = await supabase
      .from('clients')
      .update({
        nome_cliente: editNome,
        tel: editTel,
        email: editEmail,
        is_active: isActive
      })
      .eq('id', client.id);

    if (!error) {
      setIsProfileModalVisible(false);
      fetchData();
    } else {
      Alert.alert("Errore", "Impossibile aggiornare il profilo");
    }
  };

  const remaining = sub.sessions_remaining || 0;
  const totalSessions = sub.total_sessions || 0;
  const totalPaid = sub.total_paid || 0;
  const totalPrice = sub.total_price || 0;
  const saldoDaIncassare = totalPrice - totalPaid;
  const usedSessions = totalSessions - remaining;
  const progress = totalSessions > 0 ? usedSessions / totalSessions : 0;
// --- FUNZIONI DI ELIMINAZIONE ---
  const handleDeleteWorkout = async (workoutId) => {
  try {
    // 1. Elimina la seduta dal database
    const { error: delError } = await supabase.from('workouts').delete().eq('id', workoutId);
    
    if (delError) {
      Alert.alert("Errore", "Impossibile eliminare la seduta");
      return;
    }

    // 2. RIPRISTINA IL CONTATORE (+1)
    // sub è l'abbonamento che stiamo già usando nel componente
    const nuovoConteggio = (sub.sessions_remaining || 0) + 1;
    
    const { error: subError } = await supabase
      .from('subscriptions')
      .update({ sessions_remaining: nuovoConteggio })
      .eq('id', sub.id);

    if (subError) {
      console.error("Errore ripristino contatore:", subError.message);
    }

    // 3. AGGIORNA TUTTO
    // Aggiorna i dati globali (per far vedere il nuovo numero in App.js)
    await fetchData(); 

    // Aggiorna la lista locale (per far sparire la riga)
    setWorkouts((prev) => prev.filter(w => w.id !== workoutId));

    console.log("Seduta eliminata e credito ripristinato!");
  } catch (err) {
    console.error("Errore:", err);
  }
};

  const handleDeletePayment = async (paymentId, amount) => {
    console.log("Inizio eliminazione pagamento:", paymentId);
    try {
      const { error: pError } = await supabase.from('payments').delete().eq('id', paymentId);
      if (!pError) {
        const newTotalPaid = (sub.total_paid || 0) - amount;
        await supabase.from('subscriptions').update({ total_paid: newTotalPaid }).eq('id', sub.id);
        await fetchData();
      } else {
        console.error("Errore storno:", pError.message);
      }
    } catch (err) {
      console.error("Errore catch pagamento:", err);
    }
  };
  useEffect(() => {
  const fetchClientWorkouts = async () => {
    const { data } = await supabase
      .from('workouts')
      .select('*')
      .eq('client_id', client.id)
      .order('workout_date', { ascending: false });
    if (data) setWorkouts(data);
  };
  fetchClientWorkouts();
}, [client.id]); // Si attiva solo quando cambi cliente
  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
    <Image 
  source={{ uri: LOGO_URL }} 
  style={[StyleSheet.absoluteFill, { opacity: 0.05, width: '100%', height: '100%' }]} 
  resizeMode="contain" 
/>
      {/* HEADER */}
      <View style={styles.detailsHeader}>
        <TouchableOpacity onPress={onBack}><Text style={styles.backArrow}>←</Text></TouchableOpacity>
        <Text style={styles.headerName}>{client.nome_cliente}</Text>
        <TouchableOpacity onPress={() => setIsProfileModalVisible(true)}>
          <Text style={{ fontSize: 22 }}>✏️</Text>
        </TouchableOpacity>
      </View>
      
      {/* KPI CONTAINER */}
      <View style={styles.detailsKpiContainer}>
        <View style={styles.kpiMini}>
          <Text style={styles.kpiMiniValue}>{remaining}/{totalSessions}</Text>
          <Text style={styles.kpiMiniLabel}>Rimanenti</Text>
        </View>
        <View style={styles.kpiMini}>
          <Text style={[styles.kpiMiniValue, { color: '#EF4444' }]}>€{saldoDaIncassare}</Text>
          <Text style={styles.kpiMiniLabel}>Saldo</Text>
        </View>
        <View style={styles.kpiMini}>
          <Text style={styles.kpiMiniValue}>{usedSessions}</Text>
          <Text style={styles.kpiMiniLabel}>Effettuate</Text>
        </View>
      </View>

      {/* TABS MENU */}
      <View style={styles.sheetTabs}>
        {['PANORAMICA', 'SEDUTE', 'PAGAMENTI'].map((t) => (
          <TouchableOpacity 
            key={t} 
            onPress={() => setActiveSheet(t)} 
            style={[styles.sheetTab, activeSheet === t && styles.sheetTabActive]}
          >
            <Text style={{ color: activeSheet === t ? '#6D28D9' : '#6B7280', fontWeight: 'bold', fontSize: 12 }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* --- PANORAMICA --- */}
{activeSheet === 'PANORAMICA' && (
  <View style={{ padding: 20 }}>
    <TouchableOpacity 
  style={styles.addPackageBtn} 
  onPress={() =>{
    console.log("Pulsante premuto!"); // Se questo non esce, c'è un elemento sopra il tasto
    setAddPackageModal(true);
  }}
>
  <Text style={styles.addPackageBtnText}>+ Aggiungi Pacchetto</Text>
</TouchableOpacity>

   {/* 1. BOX ISCRIZIONE */}
  <View style={styles.overviewCard}>
    <Text style={styles.cardTitle}>Iscrizione</Text>
    
    <View style={styles.overviewRow}>
      <Text style={styles.overviewLabel}>Iscritto dal</Text>
      <Text style={styles.overviewValue}>
        {new Date(client.created_at).toLocaleDateString('it-IT')}
      </Text>
    </View>

    {/* --- AGGIUNTA: Ultimo pacchetto acquistato --- */}
    <View style={styles.overviewRow}>
      <Text style={styles.overviewLabel}>Data acquisto ultimo pacchetto</Text>
      <Text style={styles.overviewValue}>
        {client.subscriptions && client.subscriptions.length > 0 
          ? new Date(client.subscriptions[0].created_at).toLocaleDateString('it-IT') 
          : 'Nessuno'}
      </Text>
    </View>

    {client.tel && (
      <TouchableOpacity 
        style={styles.whatsappBtn} 
        onPress={() => Linking.openURL(`https://wa.me/${client.tel}`)}
      >
        <Text style={styles.whatsappText}>Contatta su WhatsApp</Text>
      </TouchableOpacity>
    )}
  </View>

    {/* 2. BOX PACCHETTO ATTIVO (SPOSTATO SOPRA) */}
    <View style={styles.overviewCard}>
      <Text style={styles.cardTitle}>Dettaglio Pacchetto Attivo</Text>
      
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Sedute totali</Text>
        <Text style={styles.summaryValue}>{totalSessions}</Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Prezzo concordato</Text>
        <Text style={styles.summaryValue}>€{totalPrice}</Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Totale incassato</Text>
        <Text style={[styles.summaryValue, { color: '#22C55E' }]}>€{totalPaid}</Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Residuo da incassare</Text>
        <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
          €{saldoDaIncassare > 0 ? saldoDaIncassare : 0}
        </Text>
      </View>

      <View style={{ marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={styles.progressText}>{usedSessions} effettuate</Text>
          <Text style={[styles.progressText, { fontWeight: 'bold', color: '#6D28D9' }]}>
            {remaining} rimanenti
          </Text>
        </View>
      </View>
    </View>

    {/* 3. BOX NOTE (SPOSTATO IN FONDO) */}
    <View style={styles.overviewCard}>
      <Text style={styles.cardTitle}>Note e Obiettivi</Text>
      <TextInput
        style={[styles.input, { height: 100, textAlignVertical: 'top', backgroundColor: '#FDFCFB', marginTop: 10 }]}
        multiline
        placeholder="Infortuni, allergie, obiettivi..."
        value={notes}
        onChangeText={setNotes}
      />
      <Text style={{ fontSize: 10, color: '#9CA3AF', textAlign: 'right' }}>
        Salvataggio automatico attivo
      </Text>
    </View>
<TouchableOpacity 
  style={styles.exportBtnSmall} 
  onPress={() => {
    let csv = `Storico Atleta: ${client.nome_cliente}\n\n`;
    
    // PACCHETTI (Tabella subscriptions)
    csv += "--- PACCHETTI ---\nData;Pacchetto;Prezzo;Pagato\n";
    (client.subscriptions || []).forEach(s => {
      csv += `${new Date(s.created_at).toLocaleDateString()};${s.total_sessions} sedute;${s.total_price}€;${s.total_paid}€\n`;
    });

    // PAGAMENTI (Tabella payments)
    csv += "\n--- PAGAMENTI ---\nData;Importo;Metodo\n";
    (client.payments || []).forEach(p => {
      csv += `${new Date(p.created_at).toLocaleDateString()};${p.amount}€;${p.method}\n`;
    });
    
    // SEDUTE (Tabella workouts)
    csv += "\n--- SEDUTE ---\nData\n";
    (workouts || []).forEach(w => { // Usiamo lo stato workouts che hai già nel componente
      csv += `${new Date(w.workout_date).toLocaleDateString()}\n`;
    });

    downloadCSV(csv, `Storico_${client.nome_cliente}.csv`);
  }}
>
  <Text style={styles.exportBtnText}>📄 Scarica Storico Completo</Text>
</TouchableOpacity>
  </View>
)}

 {/* --- TAB SEDUTE --- */}
        {activeSheet === 'SEDUTE' && (
          <View style={{ padding: 20 }}>
            {workouts.map((workout) => (
              <View key={workout.id} style={[styles.sessionCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <Text style={styles.sessionDate}>
                  {new Date(workout.workout_date).toLocaleDateString('it-IT')}
                </Text>
                <TouchableOpacity 
  onPress={() => handleDeleteWorkout(workout.id)}
  style={{ padding: 10, backgroundColor: '#FEE2E2', borderRadius: 8 }} // Area rossa chiara
>
  <Text style={{ color: '#EF4444', fontWeight: 'bold' }}>Elimina 🗑️</Text>
</TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* --- TAB PAGAMENTI --- */}
        {activeSheet === 'PAGAMENTI' && (
  <View style={{ padding: 20 }}>
    <View style={styles.registrationCard}>
      <Text style={styles.cardTitle}>Registra Pagamento</Text>
      
      <TextInput 
        placeholder="Euro €" 
        keyboardType="numeric" 
        value={amount} 
        onChangeText={setAmount} 
        style={styles.input} 
      />
      
      <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Data Pagamento:</Text>
      
      {/* SELETTORE DATA PER REGISTRAZIONE */}
      <DateSelector 
        value={paymentDate} 
        onChange={setPaymentDate} 
        color="#22C55E" 
      />

      <View style={[styles.methodSelector, { marginTop: 15 }]}>
        {['Cash', 'Bonif.'].map((m) => (
          <TouchableOpacity 
            key={m} 
            onPress={() => setMethod(m)} 
            style={[styles.methodBtn, method === m && { backgroundColor: '#22C55E' }]}
          >
            <Text style={{ color: method === m ? '#FFF' : '#000', fontWeight: 'bold' }}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>
                 
              <TouchableOpacity 
  style={styles.saveBtn} 
  onPress={async () => {
    const val = Number(amount);
    if (!val) {
      Alert.alert("Attenzione", "Inserisci un importo valido");
      return;
    }

    try {
      // FIX: Trasformiamo paymentDate in un oggetto Date sicuro prima di usare .toISOString()
      const safeDate = new Date(paymentDate);
      
      // Verifichiamo che la data sia valida (evita crash se il selettore fallisce)
      if (isNaN(safeDate.getTime())) {
        Alert.alert("Errore", "Data non valida");
        return;
      }

      const { error: pError } = await supabase.from('payments').insert([{ 
        client_id: client.id, 
        subscription_id: sub.id, 
        amount: val, 
        method: method,
        // Ora toISOString() non fallirà più
        created_at: safeDate.toISOString() 
      }]);

      if (!pError) {
        const newTotalPaid = (sub.total_paid || 0) + val;
        await supabase.from('subscriptions').update({ total_paid: newTotalPaid }).eq('id', sub.id);
        setAmount('');
        Alert.alert("Successo", "Pagamento registrato");
        fetchData();
      } else {
        throw pError;
      }
    } catch (err) {
      console.error("Errore salvataggio pagamento:", err.message);
      Alert.alert("Errore", "Impossibile salvare il pagamento");
    }
  }}
>
  <Text style={styles.saveBtnText}>Conferma Incasso</Text>
</TouchableOpacity>
            </View>

            {(client.payments || []).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).map((p) => (
              <View key={p.id} style={[styles.sessionCard, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View>
                  <Text style={{ fontWeight: 'bold', color: '#22C55E', fontSize: 16 }}>+ €{p.amount}</Text>
                  <Text style={{ fontSize: 11, color: '#6B7280' }}>{p.method} • {new Date(p.created_at).toLocaleDateString('it-IT')}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeletePayment(p.id, p.amount)}>
                  <Text style={{ color: '#EF4444' }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* MODAL PROFILO - FUORI DA SCROLLVIEW */}
      <Modal visible={isProfileModalVisible} animationType="slide" transparent={true}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#FFF', borderRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20, color: '#6D28D9' }}>Modifica Profilo</Text>
            <TextInput style={styles.input} placeholder="Nome" value={editNome} onChangeText={setEditNome} />
            <TextInput style={styles.input} placeholder="Telefono" value={editTel} onChangeText={setEditTel} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Email" value={editEmail} onChangeText={setEditEmail} autoCapitalize="none" />
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15 }}>
              <Text style={{ fontWeight: 'bold' }}>Stato Atleta:</Text>
              <TouchableOpacity onPress={() => setIsActive(!isActive)} style={{ backgroundColor: isActive ? '#22C55E' : '#EF4444', padding: 10, borderRadius: 10 }}>
                <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{isActive ? 'ATTIVO' : 'DISATTIVATO'}</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1, backgroundColor: '#9CA3AF' }]} onPress={() => setIsProfileModalVisible(false)}>
                <Text style={styles.saveBtnText}>Chiudi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { flex: 1 }]} onPress={handleUpdateProfile}>
                <Text style={styles.saveBtnText}>Salva</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        
      </Modal>
      <AddPackageModal
        visible={addPackageModal}
        onClose={() => setAddPackageModal(false)}
        client={client}
        user={session?.user}
        onSuccess={() => {
          fetchData(); // Questo ricarica i dati e aggiorna le sedute rimanenti
          setAddPackageModal(false);
        }}
      />
    </View>
    
  );
}

function BottomBar({ activeTab, onChange }) {
  const tabs = [
    { id: 'HOME', icon: '🏠' },
    { id: 'CLIENTS', icon: '👥' },
    { id: 'SESSIONS', icon: '🏋️' },
    { id: 'PAYMENTS', icon: '💳' },
    { id: 'ACCOUNTING', icon: '📊' },
  ];
  
  return (
    <View style={styles.bottomBar}>
      {tabs.map((t) => (
        <TouchableOpacity key={t.id} style={styles.tabItem} onPress={() => onChange(t.id)}>
          <Text style={{ fontSize: 24, opacity: activeTab === t.id ? 1 : 0.3 }}>{t.icon}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function KpiCard({ label, value, color = '#1F2937' }) {
  return (
    <View style={styles.kpiCard}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function QuickBtn({ label, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.quickActionBox} onPress={onPress}>
      <View style={styles.quickIconCircle}><Text style={{ fontSize: 22 }}>{icon}</Text></View>
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

 


/* ===== 6. STILI ===== */
const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#F4F6F8' },
  content: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  homeContainer: { flex: 1, paddingHorizontal: 20 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  logoSmall: { width: 50, height: 50 },
  logoutText: { color: '#EF4444', fontWeight: 'bold' },
  welcome: { fontSize: 22, fontWeight: 'bold' },
  dateText: { color: '#6B7280', marginBottom: 20 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  kpiCard: {
    width: '48%',
    backgroundColor: '#FFF',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    alignItems: 'center',
    elevation: 2,
    // AGGIUNTA iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  kpiValue: { fontSize: 18, fontWeight: 'bold' },
  kpiLabel: { fontSize: 11, color: '#6B7280' },
  actionBox: {
    backgroundColor: '#FFF',
    padding: 18,
    borderRadius: 15,
    borderLeftWidth: 6,
    borderLeftColor: '#EF4444',
    marginVertical: 10,
    // AGGIUNTA iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionBoxText: { fontWeight: 'bold' },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
  },
  quickActionBox: { width: '30%', alignItems: 'center' },
  quickIconCircle: {
    width: 55,
    height: 55,
    backgroundColor: '#FFF',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 3,
    // AGGIUNTA iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickLabel: { fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
  clientsWrapper: { flex: 1, padding: 20 },
  sectionTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  searchInput: {
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
  },
  clientCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    // AGGIUNTA iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  clientName: { fontSize: 18, fontWeight: 'bold' },
  plusBtn: {
    backgroundColor: '#6D28D9',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusBtnText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  detailsHeader: {
    backgroundColor: '#6D28D9',
    padding: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerName: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  backArrow: { color: '#FFF', fontSize: 28 },
  detailsKpiContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: '#6D28D9',
  },
  detailsKpiCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 12,
    borderRadius: 15,
    width: '40%',
  },
  detailsKpiVal: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  detailsKpiLab: { color: '#E9D5FF', fontSize: 10 },
  infoCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 15,
    margin: 20,
  },
  cardTitle: { fontWeight: 'bold', marginBottom: 10 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 25,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  inputLabel: { fontSize: 12, color: '#6B7280', marginBottom: 5 },
  input: {
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  inputAuth: {
    width: '100%',
    backgroundColor: '#F3F4F6',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  row: { flexDirection: 'row' },
  methodSelector: { flexDirection: 'row', gap: 5 },
  methodBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  methodBtnActive: { backgroundColor: '#6D28D9' },
  saveBtn: {
    backgroundColor: '#6D28D9',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: { color: '#FFF', fontWeight: 'bold' },
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFF',
    height: 75,
    paddingBottom: 10,
  },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sheetTabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFF',
    paddingVertical: 12,
  },
  kpiMini: {
    width: '30%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  kpiMiniValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  kpiMiniLabel: {
    fontSize: 10,
    color: '#E9D5FF',
    marginTop: 4,
  },
  sheetTab: {
    paddingBottom: 6,
  },
  sheetTabActive: {
    borderBottomWidth: 3,
    borderBottomColor: '#6D28D9',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: '#22C55E',
    borderRadius: 10,
  },
  detailsBgLogo: {
    position: 'absolute',
    top: 140,
    alignSelf: 'center',
    width: 240,
    height: 240,
    opacity: 0.04,
    zIndex: 0,
  },
  overviewCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 20,
    marginBottom: 15,
    elevation: 4,
    // AGGIUNTA iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  overviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  overviewLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  overviewValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  whatsappBtn: {
    marginTop: 12,
    backgroundColor: '#22C55E',
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  modernCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 15,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    // AGGIUNTA iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  whatsappText: {
    color: '#FFF',
    fontWeight: 'bold',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  addPackageBtn: {
    marginTop: 16,
    backgroundColor: '#6D28D9',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  addPackageText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  progressText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'right',
  },
  sessionCard: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    // AGGIUNTA iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sessionDate: {
    fontWeight: 'bold',
    marginBottom: 10,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
    marginBottom: 15,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBtnActive: {
    backgroundColor: '#FFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#6D28D9',
  },
  sessionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backgroundImage: {
    position: 'absolute',
    top: '25%',
    alignSelf: 'center',
    width: '80%',
    height: '50%',
    opacity: 0.05,
    zIndex: -1,
  },
  accMonthChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  accKpiCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 15,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    elevation: 2,
    // AGGIUNTA iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  accKpiLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6B7280',
    marginBottom: 5,
    letterSpacing: 1,
  },
  accKpiValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  exportBtnMain: {
    backgroundColor: '#059669',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#047857',
  },
  exportBtnSmall: {
    backgroundColor: '#4B5563', 
    padding: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 5,
    marginBottom: 15,
  },
  exportBtnText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});