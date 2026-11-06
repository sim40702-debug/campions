#include "MRWMoto.h"

#include "Camera/CameraComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/Engine.h"
#include "Engine/LocalPlayer.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/GameUserSettings.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "MRWCicloGiorno.h"
#include "MRWTerreno.h"
#include "ProceduralMeshComponent.h"
#include "UObject/ConstructorHelpers.h"

// Accelerazione di gravita' (m/s2)
static const float G = 9.81f;

AMRWMoto::AMRWMoto()
{
	PrimaryActorTick.bCanEverTick = true;
	AutoPossessPlayer = EAutoReceiveInput::Disabled;

	// Forme semplici di Unreal (cubo, cilindro, sfera: 100 cm)
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cubo(TEXT("/Engine/BasicShapes/Cube.Cube"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Cilindro(TEXT("/Engine/BasicShapes/Cylinder.Cylinder"));
	static ConstructorHelpers::FObjectFinder<UStaticMesh> Sfera(TEXT("/Engine/BasicShapes/Sphere.Sphere"));

	// Radice = punto in cui la ruota posteriore tocca terra
	Radice = CreateDefaultSubobject<USceneComponent>(TEXT("Radice"));
	RootComponent = Radice;

	// La moto piega attorno alla linea che unisce i due punti di appoggio
	PernoPiega = CreateDefaultSubobject<USceneComponent>(TEXT("PernoPiega"));
	PernoPiega->SetupAttachment(Radice);

	// L'impennata ruota attorno al perno della ruota posteriore
	PernoImpennata = CreateDefaultSubobject<USceneComponent>(TEXT("PernoImpennata"));
	PernoImpennata->SetupAttachment(PernoPiega);
	PernoImpennata->SetRelativeLocation(FVector(0.0f, 0.0f, RaggioRuota * 100.0f));

	MozzoPosteriore = CreateDefaultSubobject<USceneComponent>(TEXT("MozzoPosteriore"));
	MozzoPosteriore->SetupAttachment(PernoImpennata);

	Sterzo = CreateDefaultSubobject<USceneComponent>(TEXT("Sterzo"));
	Sterzo->SetupAttachment(PernoImpennata);
	Sterzo->SetRelativeLocation(FVector(Interasse * 100.0f, 0.0f, 0.0f));

	MozzoAnteriore = CreateDefaultSubobject<USceneComponent>(TEXT("MozzoAnteriore"));
	MozzoAnteriore->SetupAttachment(Sterzo);

	// Pezzi (misure in metri / 1, rispetto alla forma da 100 cm). Disegno originale MRW, non una replica.
	const FRotator Ruota(0.0f, 0.0f, 90.0f);
	AggiungiPezzo(TEXT("RuotaPosteriore"), MozzoPosteriore, Cilindro.Object, FVector::ZeroVector, FVector(0.62f, 0.62f, 0.16f), Ruota);
	AggiungiPezzo(TEXT("RuotaAnteriore"), MozzoAnteriore, Cilindro.Object, FVector::ZeroVector, FVector(0.62f, 0.62f, 0.12f), Ruota);
	AggiungiPezzo(TEXT("Forcellone"), PernoImpennata, Cubo.Object, FVector(28.0f, 0.0f, 5.0f), FVector(0.56f, 0.10f, 0.06f), FRotator(10.0f, 0.0f, 0.0f));
	AggiungiPezzo(TEXT("Motore"), PernoImpennata, Cubo.Object, FVector(68.0f, 0.0f, 22.0f), FVector(0.42f, 0.26f, 0.36f));
	AggiungiPezzo(TEXT("Telaio"), PernoImpennata, Cubo.Object, FVector(80.0f, 0.0f, 50.0f), FVector(0.70f, 0.12f, 0.08f), FRotator(-12.0f, 0.0f, 0.0f));
	AggiungiPezzo(TEXT("Serbatoio"), PernoImpennata, Cubo.Object, FVector(88.0f, 0.0f, 64.0f), FVector(0.38f, 0.30f, 0.18f));
	AggiungiPezzo(TEXT("Sella"), PernoImpennata, Cubo.Object, FVector(42.0f, 0.0f, 70.0f), FVector(0.62f, 0.24f, 0.08f));
	AggiungiPezzo(TEXT("Codone"), PernoImpennata, Cubo.Object, FVector(2.0f, 0.0f, 72.0f), FVector(0.30f, 0.18f, 0.06f), FRotator(12.0f, 0.0f, 0.0f));
	AggiungiPezzo(TEXT("Scarico"), PernoImpennata, Cilindro.Object, FVector(20.0f, 17.0f, 34.0f), FVector(0.09f, 0.09f, 0.55f), FRotator(75.0f, 0.0f, 0.0f));
	AggiungiPezzo(TEXT("Forcella"), Sterzo, Cubo.Object, FVector(-14.0f, 0.0f, 38.0f), FVector(0.06f, 0.20f, 0.85f), FRotator(25.0f, 0.0f, 0.0f));
	AggiungiPezzo(TEXT("Tabella"), Sterzo, Cubo.Object, FVector(-20.0f, 0.0f, 72.0f), FVector(0.05f, 0.22f, 0.26f), FRotator(25.0f, 0.0f, 0.0f));
	AggiungiPezzo(TEXT("Manubrio"), Sterzo, Cubo.Object, FVector(-36.0f, 0.0f, 88.0f), FVector(0.04f, 0.78f, 0.04f));
	AggiungiPezzo(TEXT("Parafango"), Sterzo, Cubo.Object, FVector(8.0f, 0.0f, 36.0f), FVector(0.40f, 0.16f, 0.03f), FRotator(-8.0f, 0.0f, 0.0f));

	// Pilota provvisorio (sara' sostituito nella fase 6)
	AggiungiPezzo(TEXT("PilotaBusto"), PernoImpennata, Cubo.Object, FVector(48.0f, 0.0f, 108.0f), FVector(0.26f, 0.40f, 0.58f), FRotator(-28.0f, 0.0f, 0.0f));
	AggiungiPezzo(TEXT("PilotaCasco"), PernoImpennata, Sfera.Object, FVector(72.0f, 0.0f, 146.0f), FVector(0.28f, 0.26f, 0.28f));
	AggiungiPezzo(TEXT("PilotaGambaSinistra"), PernoImpennata, Cubo.Object, FVector(55.0f, -20.0f, 62.0f), FVector(0.45f, 0.12f, 0.14f), FRotator(-35.0f, 0.0f, 0.0f));
	AggiungiPezzo(TEXT("PilotaGambaDestra"), PernoImpennata, Cubo.Object, FVector(55.0f, 20.0f, 62.0f), FVector(0.45f, 0.12f, 0.14f), FRotator(-35.0f, 0.0f, 0.0f));
	AggiungiPezzo(TEXT("PilotaBraccioSinistro"), PernoImpennata, Cubo.Object, FVector(88.0f, -24.0f, 112.0f), FVector(0.42f, 0.09f, 0.09f), FRotator(-20.0f, 0.0f, 0.0f));
	AggiungiPezzo(TEXT("PilotaBraccioDestro"), PernoImpennata, Cubo.Object, FVector(88.0f, 24.0f, 112.0f), FVector(0.42f, 0.09f, 0.09f), FRotator(-20.0f, 0.0f, 0.0f));

	// Telecamera in terza persona: dietro e sopra, non piega con la moto
	Braccio = CreateDefaultSubobject<USpringArmComponent>(TEXT("Braccio"));
	Braccio->SetupAttachment(Radice);
	Braccio->SetRelativeLocation(FVector(70.0f, 0.0f, 110.0f));
	Braccio->SetRelativeRotation(FRotator(-9.0f, 0.0f, 0.0f));
	Braccio->TargetArmLength = 430.0f;
	Braccio->bEnableCameraLag = true;
	Braccio->CameraLagSpeed = 9.0f;
	Braccio->bEnableCameraRotationLag = true;
	Braccio->CameraRotationLagSpeed = 7.0f;
	Braccio->bInheritRoll = false;
	Braccio->bDoCollisionTest = true;

	CameraTerza = CreateDefaultSubobject<UCameraComponent>(TEXT("CameraTerza"));
	CameraTerza->SetupAttachment(Braccio);
	CameraTerza->SetFieldOfView(80.0f);

	// Telecamera in prima persona: nel casco, piega con la moto
	CameraPrima = CreateDefaultSubobject<UCameraComponent>(TEXT("CameraPrima"));
	CameraPrima->SetupAttachment(PernoImpennata);
	CameraPrima->SetRelativeLocation(FVector(80.0f, 0.0f, 150.0f));
	CameraPrima->SetFieldOfView(90.0f);
	CameraPrima->SetAutoActivate(false);
}

UStaticMeshComponent* AMRWMoto::AggiungiPezzo(const TCHAR* Nome, USceneComponent* Padre, UStaticMesh* Forma,
	FVector Posizione, FVector Misura, FRotator Rotazione)
{
	UStaticMeshComponent* Pezzo = CreateDefaultSubobject<UStaticMeshComponent>(Nome);
	Pezzo->SetupAttachment(Padre);
	Pezzo->SetStaticMesh(Forma);
	Pezzo->SetRelativeLocation(Posizione);
	Pezzo->SetRelativeRotation(Rotazione);
	Pezzo->SetRelativeScale3D(Misura);
	Pezzo->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	return Pezzo;
}

void AMRWMoto::ColoraPezzi()
{
	// Il materiale delle forme di Unreal ha un parametro "Color"
	TArray<UStaticMeshComponent*> Pezzi;
	GetComponents<UStaticMeshComponent>(Pezzi);
	for (UStaticMeshComponent* Pezzo : Pezzi)
	{
		const FString Nome = Pezzo->GetName();
		FLinearColor Colore(0.35f, 0.35f, 0.37f);                      // metallo
		if (Nome.StartsWith(TEXT("Ruota"))) Colore = FLinearColor(0.02f, 0.02f, 0.02f);
		if (Nome == TEXT("Serbatoio") || Nome == TEXT("Tabella") || Nome == TEXT("Parafango") || Nome == TEXT("Codone"))
		{
			Colore = FLinearColor(0.02f, 0.45f, 0.42f);                // verde acqua MRW
		}
		if (Nome == TEXT("Sella")) Colore = FLinearColor(0.03f, 0.03f, 0.03f);
		if (Nome.StartsWith(TEXT("Pilota"))) Colore = FLinearColor(0.06f, 0.06f, 0.08f);
		if (Nome == TEXT("PilotaCasco")) Colore = FLinearColor(0.85f, 0.85f, 0.85f);
		UMaterialInstanceDynamic* Materiale = Pezzo->CreateAndSetMaterialInstanceDynamic(0);
		if (Materiale != nullptr)
		{
			Materiale->SetVectorParameterValue(TEXT("Color"), Colore);
		}
	}
}

void AMRWMoto::BeginPlay()
{
	Super::BeginPlay();
	ColoraPezzi();
	for (TActorIterator<AMRWTerreno> It(GetWorld()); It; ++It)
	{
		Terreno = *It;
	}
	for (TActorIterator<AMRWCicloGiorno> It(GetWorld()); It; ++It)
	{
		Meteo = *It;
	}
	// Senza terreno del Ticino la moto parte dove si trova (per provare su un livello qualsiasi)
	if (Terreno == nullptr)
	{
		bPosizionata = true;
		bAppoggiata = false;
		Imbardata = GetActorRotation().Yaw;
	}
}

// ---------------------------------------------------------------- Comandi

UInputAction* AMRWMoto::NuovaAzione(const TCHAR* Nome)
{
	UInputAction* Azione = NewObject<UInputAction>(this, Nome);
	Azione->ValueType = EInputActionValueType::Axis1D;
	return Azione;
}

void AMRWMoto::Mappa(UInputAction* Azione, FKey Tasto, bool bNegativo)
{
	FEnhancedActionKeyMapping& Mappatura = Contesto->MapKey(Azione, Tasto);
	if (bNegativo)
	{
		Mappatura.Modifiers.Add(NewObject<UInputModifierNegate>(this));
	}
}

void AMRWMoto::CreaComandi()
{
	Contesto = NewObject<UInputMappingContext>(this, TEXT("ComandiMoto"));

	AzioneGas = NuovaAzione(TEXT("Gas"));
	Mappa(AzioneGas, EKeys::W);
	Mappa(AzioneGas, EKeys::Up);
	Mappa(AzioneGas, EKeys::Gamepad_RightTriggerAxis);

	AzioneFrenoAnteriore = NuovaAzione(TEXT("FrenoAnteriore"));
	Mappa(AzioneFrenoAnteriore, EKeys::S);
	Mappa(AzioneFrenoAnteriore, EKeys::Down);
	Mappa(AzioneFrenoAnteriore, EKeys::Gamepad_LeftTriggerAxis);

	AzioneFrenoPosteriore = NuovaAzione(TEXT("FrenoPosteriore"));
	Mappa(AzioneFrenoPosteriore, EKeys::SpaceBar);
	Mappa(AzioneFrenoPosteriore, EKeys::Gamepad_FaceButton_Left);

	AzioneSterzo = NuovaAzione(TEXT("Sterzo"));
	Mappa(AzioneSterzo, EKeys::D);
	Mappa(AzioneSterzo, EKeys::Right);
	Mappa(AzioneSterzo, EKeys::A, true);
	Mappa(AzioneSterzo, EKeys::Left, true);
	Mappa(AzioneSterzo, EKeys::Gamepad_LeftX);

	// Peso indietro: aiuta a impennare (Shift, oppure levetta sinistra tirata indietro)
	AzionePeso = NuovaAzione(TEXT("PesoIndietro"));
	Mappa(AzionePeso, EKeys::LeftShift);
	Mappa(AzionePeso, EKeys::Gamepad_LeftY, true);

	AzioneCamera = NuovaAzione(TEXT("Camera"));
	Mappa(AzioneCamera, EKeys::C);
	Mappa(AzioneCamera, EKeys::Gamepad_FaceButton_Top);

	AzioneRiparti = NuovaAzione(TEXT("Riparti"));
	Mappa(AzioneRiparti, EKeys::R);
	Mappa(AzioneRiparti, EKeys::Gamepad_Special_Left);

	AzioneAiuto = NuovaAzione(TEXT("ControlloImpennata"));
	Mappa(AzioneAiuto, EKeys::I);

	AzioneOra = NuovaAzione(TEXT("Ora"));
	Mappa(AzioneOra, EKeys::T);

	AzionePioggia = NuovaAzione(TEXT("Pioggia"));
	Mappa(AzionePioggia, EKeys::P);

	// Tasti 1-5: preset LOW, MEDIUM, HIGH, ULTRA, CINEMATIC
	const FKey Tasti[5] = { EKeys::One, EKeys::Two, EKeys::Three, EKeys::Four, EKeys::Five };
	for (int32 i = 0; i < 5; i++)
	{
		UInputAction* Azione = NuovaAzione(*FString::Printf(TEXT("Preset%d"), i));
		Mappa(Azione, Tasti[i]);
		AzioniPreset.Add(Azione);
	}
}

void AMRWMoto::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	if (Contesto == nullptr)
	{
		CreaComandi();
	}
	UEnhancedInputComponent* Ingresso = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (Ingresso == nullptr)
	{
		UE_LOG(LogTemp, Error, TEXT("[MRW] Enhanced Input non attivo: controlla Config/DefaultInput.ini"));
		return;
	}
	// Comandi continui: il valore si legge ad ogni frame
	Ingresso->BindActionValue(AzioneGas);
	Ingresso->BindActionValue(AzioneFrenoAnteriore);
	Ingresso->BindActionValue(AzioneFrenoPosteriore);
	Ingresso->BindActionValue(AzioneSterzo);
	Ingresso->BindActionValue(AzionePeso);

	// Tasti: una volta quando si premono
	Ingresso->BindAction(AzioneCamera, ETriggerEvent::Started, this, &AMRWMoto::CambiaCamera);
	Ingresso->BindAction(AzioneRiparti, ETriggerEvent::Started, this, &AMRWMoto::Riparti);
	Ingresso->BindAction(AzioneAiuto, ETriggerEvent::Started, this, &AMRWMoto::CambiaAiuto);
	Ingresso->BindAction(AzioneOra, ETriggerEvent::Started, this, &AMRWMoto::AvantiUnOra);
	Ingresso->BindAction(AzionePioggia, ETriggerEvent::Started, this, &AMRWMoto::CambiaPioggia);
	Ingresso->BindAction(AzioniPreset[0], ETriggerEvent::Started, this, &AMRWMoto::PresetLow);
	Ingresso->BindAction(AzioniPreset[1], ETriggerEvent::Started, this, &AMRWMoto::PresetMedium);
	Ingresso->BindAction(AzioniPreset[2], ETriggerEvent::Started, this, &AMRWMoto::PresetHigh);
	Ingresso->BindAction(AzioniPreset[3], ETriggerEvent::Started, this, &AMRWMoto::PresetUltra);
	Ingresso->BindAction(AzioniPreset[4], ETriggerEvent::Started, this, &AMRWMoto::PresetCinematic);
}

void AMRWMoto::PawnClientRestart()
{
	Super::PawnClientRestart();
	if (Contesto == nullptr)
	{
		CreaComandi();
	}
	APlayerController* Giocatore = Cast<APlayerController>(GetController());
	if (Giocatore == nullptr)
	{
		return;
	}
	UEnhancedInputLocalPlayerSubsystem* Sistema = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(Giocatore->GetLocalPlayer());
	if (Sistema != nullptr)
	{
		Sistema->ClearAllMappings();
		Sistema->AddMappingContext(Contesto, 0);
	}
}

float AMRWMoto::LeggiValore(UInputAction* Azione) const
{
	const UEnhancedInputComponent* Ingresso = Cast<UEnhancedInputComponent>(InputComponent);
	if (Ingresso == nullptr || Azione == nullptr)
	{
		return 0.0f;
	}
	return Ingresso->GetBoundActionValue(Azione).Get<float>();
}

void AMRWMoto::Mostra(const FString& Testo)
{
	Messaggio = Testo;
	TempoMessaggio = 3.0f;
}

void AMRWMoto::CambiaCamera()
{
	bPrimaPersona = !bPrimaPersona;
	CameraTerza->SetActive(!bPrimaPersona);
	CameraPrima->SetActive(bPrimaPersona);
}

void AMRWMoto::CambiaAiuto()
{
	bControlloImpennata = !bControlloImpennata;
	Mostra(bControlloImpennata ? TEXT("Controllo impennata: acceso") : TEXT("Controllo impennata: spento"));
}

void AMRWMoto::AvantiUnOra()
{
	if (Meteo != nullptr)
	{
		Meteo->OraDelGiorno = FMath::Fmod(Meteo->OraDelGiorno + 1.0f, 24.0f);
		Mostra(FString::Printf(TEXT("Ora: %02d:00"), FMath::FloorToInt(Meteo->OraDelGiorno)));
	}
}

void AMRWMoto::CambiaPioggia()
{
	if (Meteo != nullptr)
	{
		Meteo->Pioggia = Meteo->Pioggia > 0.5f ? 0.0f : 1.0f;
		Mostra(Meteo->Pioggia > 0.5f ? TEXT("Pioggia") : TEXT("Sereno (la strada si asciuga piano)"));
	}
}

void AMRWMoto::ScegliPreset(int32 Livello)
{
	const TCHAR* Nomi[5] = { TEXT("LOW"), TEXT("MEDIUM"), TEXT("HIGH"), TEXT("ULTRA"), TEXT("CINEMATIC") };
	UGameUserSettings* Impostazioni = GEngine ? GEngine->GetGameUserSettings() : nullptr;
	if (Impostazioni != nullptr)
	{
		Impostazioni->SetOverallScalabilityLevel(Livello);
		Impostazioni->ApplySettings(false);
		Impostazioni->SaveSettings();
		Mostra(FString::Printf(TEXT("Grafica: %s"), Nomi[Livello]));
	}
}

// ---------------------------------------------------------------- Posizione e cadute

void AMRWMoto::Posiziona(const FVector& Punto, const FVector& Direzione)
{
	SetActorLocation(Punto + FVector(0.0f, 0.0f, 40.0f));
	Imbardata = Direzione.Rotation().Yaw;
	Velocita = 0.0f;
	VelocitaVerticale = 0.0f;
	Piega = 0.0f;
	Beccheggio = 0.0f;
	VelocitaBeccheggio = 0.0f;
	bAppoggiata = false;
	TempoDaPartenza = 0.0f;
	PuntoSicuro = Punto;
	DirezioneSicura = Direzione;
}

void AMRWMoto::Riparti()
{
	FVector Punto = PuntoSicuro;
	FVector Direzione = DirezioneSicura;
	if (Terreno != nullptr && Terreno->DatiPronti())
	{
		Terreno->PuntoStradaVicino(GetActorLocation(), Punto, Direzione);
	}
	TempoCaduta = 0.0f;
	Posiziona(Punto, Direzione);
}

void AMRWMoto::Cadi(const FString& Motivo)
{
	if (TempoCaduta > 0.0f)
	{
		return;
	}
	TempoCaduta = 2.5f;
	Messaggio = TEXT("Caduta: ") + Motivo;
	Velocita = 0.0f;
	VelocitaBeccheggio = 0.0f;
}

bool AMRWMoto::TrovaSuolo(const FVector& Punto, float Sopra, float Sotto, FHitResult& Colpo) const
{
	FCollisionQueryParams Parametri(TEXT("SuoloMoto"), true, this);
	return GetWorld()->LineTraceSingleByChannel(Colpo, Punto + FVector(0, 0, Sopra), Punto - FVector(0, 0, Sotto),
		ECC_Visibility, Parametri);
}

// ---------------------------------------------------------------- Fisica

void AMRWMoto::Fisica(float Dt)
{
	// 1) Aderenza: asfalto (asciutto o bagnato) oppure terra/erba
	float Aderenza = bSuStrada ? AderenzaAsfalto : 0.7f;
	const float Bagnato = Meteo ? Meteo->Bagnato : 0.0f;
	if (bSuStrada)
	{
		Aderenza *= FMath::Lerp(1.0f, 0.65f, Bagnato);
	}
	const float AccMassima = Aderenza * G;   // m/s2 che le gomme possono dare

	// 2) Motore: forza = potenza / velocita', ma mai piu' della forza della prima marcia
	const float ForzaMotore = Gas * FMath::Min(ForzaMassimaRuota, PotenzaKW * 1000.0f / FMath::Max(Velocita, 1.0f));
	// La gomma posteriore non spinge piu' della sua aderenza (quando si accelera forte il peso va dietro)
	float AccMotore = FMath::Min(ForzaMotore / Massa, AccMassima);

	// 3) Freni: davanti fino a tutta l'aderenza, dietro meno (frenando il peso va davanti)
	const bool bDavantiSuSuolo = Beccheggio < 1.0f;
	const bool bDietroSuSuolo = Beccheggio > -1.0f;
	const float AccFrenoAnteriore = bDavantiSuSuolo ? FrenoAnteriore * AccMassima : 0.0f;
	const float AccFrenoPosteriore = bDietroSuSuolo ? FrenoPosteriore * AccMassima * 0.45f : 0.0f;
	const float AccFreni = Velocita > 0.05f ? AccFrenoAnteriore + AccFrenoPosteriore : 0.0f;

	// 4) Aria, rotolamento e pendenza
	const float AccAria = 0.5f * 1.2f * 0.55f * Velocita * Velocita / Massa;
	const float AccRotolamento = Velocita > 0.1f ? 0.15f : 0.0f;
	const float AccPendenza = G * FMath::Sin(FMath::DegreesToRadians(PendenzaSuolo));

	// Controllo impennata (come l'elettronica delle moto vere, si spegne con I):
	// toglie potenza quanto basta per tenere il davanti giu', oppure a 30 gradi se si tiene il peso dietro
	if (bControlloImpennata && bAppoggiata)
	{
		const float Obiettivo = PesoIndietro > 0.5f ? 30.0f : 0.0f;
		const float B = BaricentroDietro - 0.12f * PesoIndietro;
		const float H = BaricentroAltezza;
		const float Angolo = FMath::DegreesToRadians(FMath::Max(Beccheggio, 0.0f));
		const float AlfaVoluta = FMath::DegreesToRadians(-6.0f * (Beccheggio - Obiettivo) - 4.0f * VelocitaBeccheggio);
		const float AccLimite = (AlfaVoluta * (B * B + H * H) + G * (B * FMath::Cos(Angolo) - H * FMath::Sin(Angolo)))
			/ (H * FMath::Cos(Angolo)) + AccAria;
		AccMotore = FMath::Clamp(AccMotore, 0.0f, FMath::Max(AccLimite, 0.0f));
	}

	if (bAppoggiata)
	{
		Velocita += (AccMotore - AccFreni - AccAria - AccRotolamento - AccPendenza) * Dt;
		Velocita = FMath::Max(Velocita, 0.0f);   // in moto non si va indietro
	}
	else
	{
		Velocita = FMath::Max(Velocita - AccAria * Dt, 0.0f);
	}

	// 5) Cambio automatico (velocita' massima di ogni marcia in km/h)
	const float VelocitaMarce[6] = { 58.0f, 88.0f, 118.0f, 146.0f, 172.0f, 200.0f };
	const float Kmh = Velocita * 3.6f;
	Marcia = 6;
	for (int32 i = 0; i < 6; i++)
	{
		if (Kmh < VelocitaMarce[i] * 0.93f)
		{
			Marcia = i + 1;
			break;
		}
	}
	const float GiriObiettivo = 1300.0f + (Kmh / VelocitaMarce[Marcia - 1]) * 8200.0f + Gas * (Kmh < 8.0f ? 3000.0f : 0.0f);
	Giri = FMath::FInterpTo(Giri, FMath::Min(GiriObiettivo, 9600.0f), Dt, 8.0f);

	// 6) Impennata e stoppie: momento delle forze attorno alla ruota che resta a terra
	if (bAppoggiata)
	{
		const float H = BaricentroAltezza;
		const float BDietro = BaricentroDietro - 0.12f * PesoIndietro;   // peso indietro = baricentro piu' vicino alla ruota
		const float BDavanti = Interasse - BaricentroDietro;
		const float Angolo = FMath::DegreesToRadians(FMath::Abs(Beccheggio));
		const float Coseno = FMath::Cos(Angolo);
		const float Seno = FMath::Sin(Angolo);

		// Attorno alla ruota posteriore: l'accelerazione alza il davanti, la gravita' lo riporta giu'
		const float AccAvanti = AccMotore - AccFrenoPosteriore - AccAria;
		const float AlfaImpennata = (AccAvanti * H * Coseno - G * (BDietro * Coseno - H * Seno)) / (BDietro * BDietro + H * H);
		// Attorno alla ruota anteriore: la frenata alza il dietro
		const float Decelerazione = AccFrenoAnteriore + AccFrenoPosteriore + AccAria;
		const float AlfaStoppie = (Decelerazione * H * Coseno - G * (BDavanti * Coseno - H * Seno)) / (BDavanti * BDavanti + H * H);

		if (Beccheggio > 0.0f || (Beccheggio == 0.0f && AlfaImpennata > 0.0f && Velocita > 1.0f))
		{
			VelocitaBeccheggio += FMath::RadiansToDegrees(AlfaImpennata) * Dt;
			Beccheggio += VelocitaBeccheggio * Dt;
			if (Beccheggio <= 0.0f)
			{
				Beccheggio = 0.0f;
				VelocitaBeccheggio = 0.0f;
			}
		}
		else if (Beccheggio < 0.0f || (Beccheggio == 0.0f && AlfaStoppie > 0.0f && Velocita > 1.0f))
		{
			VelocitaBeccheggio -= FMath::RadiansToDegrees(AlfaStoppie) * Dt;
			Beccheggio += VelocitaBeccheggio * Dt;
			if (Beccheggio >= 0.0f)
			{
				Beccheggio = 0.0f;
				VelocitaBeccheggio = 0.0f;
			}
		}
		if (Beccheggio > 75.0f)
		{
			Cadi(TEXT("impennata oltre il punto di equilibrio"));
		}
		if (Beccheggio < -55.0f)
		{
			Cadi(TEXT("ribaltata in avanti"));
		}
	}

	// 7) Piega e direzione
	const float Lento = FMath::Clamp((Velocita - 1.5f) / 6.0f, 0.0f, 1.0f);   // 0 = quasi fermo, 1 = in velocita'
	const float UsoGomme = FMath::Clamp((AccFreni + AccMotore * 0.5f) / AccMassima, 0.0f, 1.0f);
	// Piega massima: tan(piega) = aderenza. Se si frena o si accelera ne resta meno per piegare.
	const float PiegaMassima = FMath::RadiansToDegrees(FMath::Atan(Aderenza * 0.95f)) * FMath::Sqrt(1.0f - 0.8f * UsoGomme * UsoGomme);
	const float PiegaObiettivo = SterzoComando * PiegaMassima * Lento;
	const float VelocitaPiega = FMath::Lerp(110.0f, 65.0f, FMath::Clamp(Velocita / 30.0f, 0.0f, 1.0f));
	Piega = FMath::FInterpConstantTo(Piega, PiegaObiettivo, Dt, VelocitaPiega);

	float VelocitaImbardata = 0.0f;   // gradi al secondo
	if (Velocita > 0.2f && bAppoggiata)
	{
		// Da fermo si gira con il manubrio, in velocita' con la piega: omega = g * tan(piega) / v
		const float DaSterzo = Velocita * FMath::Tan(FMath::DegreesToRadians(SterzoComando * 30.0f)) / Interasse;
		const float DaPiega = G * FMath::Tan(FMath::DegreesToRadians(Piega)) / FMath::Max(Velocita, 1.0f);
		VelocitaImbardata = FMath::RadiansToDegrees(FMath::Lerp(DaSterzo, DaPiega, Lento));
		if (Beccheggio > 5.0f)
		{
			VelocitaImbardata *= 0.3f;   // ruota davanti in aria: si gira poco
		}
	}
	Imbardata += VelocitaImbardata * Dt;

	// 8) Controllo aderenza: forza di lato + forza in avanti/indietro non possono superare quella delle gomme
	if (bAppoggiata && Velocita > 4.0f)
	{
		const float Laterale = Velocita * FMath::DegreesToRadians(FMath::Abs(VelocitaImbardata));
		const float Longitudinale = FMath::Max(AccFreni, AccMotore);
		if (FMath::Sqrt(Laterale * Laterale + Longitudinale * Longitudinale) > AccMassima * 1.08f)
		{
			Cadi(Bagnato > 0.3f ? TEXT("aderenza persa sul bagnato") : TEXT("aderenza persa"));
			return;
		}
	}

	// 9) Movimento in avanti, con controllo degli ostacoli
	const FVector Avanti = FRotator(0.0f, Imbardata, 0.0f).Vector();
	FVector Posizione = GetActorLocation();
	FVector Spostamento = Avanti * Velocita * 100.0f * Dt;
	if (Velocita > 0.1f)
	{
		FHitResult Muro;
		FCollisionQueryParams Parametri(TEXT("MuroMoto"), true, this);
		const FVector Davanti = Posizione + Avanti * Interasse * 100.0f + FVector(0.0f, 0.0f, 60.0f);
		if (GetWorld()->LineTraceSingleByChannel(Muro, Davanti, Davanti + Avanti * (Spostamento.Size() + 30.0f), ECC_Visibility, Parametri)
			&& Muro.ImpactNormal.Z < 0.6f)
		{
			if (Velocita > 7.0f)
			{
				Cadi(TEXT("urto"));
			}
			Velocita = 0.0f;
			Spostamento = FVector::ZeroVector;
		}
	}
	Posizione += Spostamento;

	// 10) Suolo sotto le due ruote
	FHitResult Dietro, Davanti;
	const FVector PuntoDavanti = Posizione + Avanti * Interasse * 100.0f;
	if (bAppoggiata)
	{
		const bool bDietro = TrovaSuolo(Posizione, 50.0f, 90.0f, Dietro);
		const bool bDavanti = TrovaSuolo(PuntoDavanti, 50.0f, 90.0f, Davanti);
		// Dove arriverebbe la moto cadendo (se il suolo scende piu' in fretta: salto)
		const float ZCaduta = Posizione.Z + (VelocitaVerticale * Dt - 0.5f * G * Dt * Dt) * 100.0f;
		if (bDietro && Dietro.ImpactPoint.Z >= ZCaduta - 2.0f)
		{
			VelocitaVerticale = (Dietro.ImpactPoint.Z - Posizione.Z) / 100.0f / Dt;
			Posizione.Z = Dietro.ImpactPoint.Z;
			if (bDavanti)
			{
				PendenzaSuolo = FMath::RadiansToDegrees(FMath::Atan2(Davanti.ImpactPoint.Z - Dietro.ImpactPoint.Z, Interasse * 100.0f));
			}
			bSuStrada = Terreno != nullptr && Dietro.GetComponent() == Terreno->GetStrade();
		}
		else
		{
			bAppoggiata = false;   // salto
		}
	}
	else
	{
		VelocitaVerticale -= G * Dt;
		Posizione.Z += VelocitaVerticale * 100.0f * Dt;
		const bool bDietro = TrovaSuolo(Posizione, 60.0f, 5.0f, Dietro);
		// Appena partiti le collisioni del terreno possono non essere ancora pronte: uso la quota del terreno
		float ZSuolo = bDietro ? Dietro.ImpactPoint.Z : -1.0e9f;
		if (!bDietro && Terreno != nullptr && Terreno->DatiPronti() && TempoDaPartenza < 5.0f)
		{
			const float Quota = Terreno->QuotaTerreno(Posizione.X, Posizione.Y);
			if (Posizione.Z <= Quota)
			{
				ZSuolo = Quota;
			}
		}
		if (ZSuolo > -1.0e8f && Posizione.Z <= ZSuolo + 1.0f)
		{
			if (VelocitaVerticale < -9.0f)
			{
				Cadi(TEXT("atterraggio troppo duro"));
			}
			Posizione.Z = ZSuolo;
			VelocitaVerticale = 0.0f;
			bAppoggiata = true;
		}
		if (VelocitaVerticale < -40.0f)
		{
			Riparti();   // caduta nel vuoto
			return;
		}
	}

	SetActorLocationAndRotation(Posizione, FRotator(bAppoggiata ? PendenzaSuolo : PendenzaSuolo * 0.98f, Imbardata, 0.0f));

	// 11) Punto sicuro per ripartire dopo una caduta (ogni 2 secondi, se tutto e' tranquillo)
	TempoPuntoSicuro -= Dt;
	if (TempoPuntoSicuro <= 0.0f && bAppoggiata && bSuStrada && FMath::Abs(Piega) < 15.0f && Beccheggio == 0.0f)
	{
		TempoPuntoSicuro = 2.0f;
		PuntoSicuro = Posizione;
		DirezioneSicura = Avanti;
	}
}

void AMRWMoto::AggiornaGrafica(float Dt)
{
	// Piega (in caduta la moto si sdraia)
	float PiegaVista = Piega;
	if (TempoCaduta > 0.0f)
	{
		PiegaVista = Piega >= 0.0f ? 80.0f : -80.0f;
	}
	PernoPiega->SetRelativeRotation(FRotator(0.0f, 0.0f, PiegaVista));

	// Impennata attorno alla ruota dietro, stoppie attorno alla ruota davanti
	const float Raggio = RaggioRuota * 100.0f;
	if (Beccheggio >= 0.0f)
	{
		PernoImpennata->SetRelativeLocationAndRotation(FVector(0.0f, 0.0f, Raggio), FRotator(Beccheggio, 0.0f, 0.0f));
	}
	else
	{
		const FRotator Rotazione(Beccheggio, 0.0f, 0.0f);
		const FVector PernoDavanti(Interasse * 100.0f, 0.0f, Raggio);
		PernoImpennata->SetRelativeLocationAndRotation(PernoDavanti + Rotazione.RotateVector(FVector(-Interasse * 100.0f, 0.0f, 0.0f)), Rotazione);
	}

	// Ruote che girano e manubrio
	AngoloRuote = FMath::Fmod(AngoloRuote + FMath::RadiansToDegrees(Velocita / RaggioRuota) * Dt, 360.0f);
	MozzoPosteriore->SetRelativeRotation(FRotator(-AngoloRuote, 0.0f, 0.0f));
	MozzoAnteriore->SetRelativeRotation(FRotator(-AngoloRuote, 0.0f, 0.0f));
	const float Lento = FMath::Clamp((Velocita - 1.5f) / 6.0f, 0.0f, 1.0f);
	Sterzo->SetRelativeRotation(FRotator(0.0f, SterzoComando * FMath::Lerp(30.0f, 3.0f, Lento), 0.0f));
}

void AMRWMoto::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	TempoMessaggio -= DeltaSeconds;

	// All'inizio: aspetto i dati del terreno e metto la moto sulla strada piu' vicina al punto di partenza
	if (!bPosizionata)
	{
		if (Terreno != nullptr && Terreno->DatiPronti())
		{
			FVector Punto = PuntoPartenza;
			FVector Direzione = FVector::ForwardVector;
			Terreno->PuntoStradaVicino(PuntoPartenza, Punto, Direzione);
			Posiziona(Punto, Direzione);
			bPosizionata = true;
		}
		else if (Terreno != nullptr && !Terreno->Errore.IsEmpty())
		{
			Messaggio = Terreno->Errore;
			TempoMessaggio = 1.0f;
		}
		return;
	}

	// Comandi
	// Il gas si apre in 0.4 s (con la tastiera altrimenti sarebbe tutto o niente)
	Gas = FMath::FInterpConstantTo(Gas, FMath::Clamp(LeggiValore(AzioneGas), 0.0f, 1.0f), DeltaSeconds, 2.5f);
	FrenoAnteriore = FMath::Clamp(LeggiValore(AzioneFrenoAnteriore), 0.0f, 1.0f);
	FrenoPosteriore = FMath::Clamp(LeggiValore(AzioneFrenoPosteriore), 0.0f, 1.0f);
	SterzoComando = FMath::Clamp(LeggiValore(AzioneSterzo), -1.0f, 1.0f);
	PesoIndietro = FMath::Clamp(LeggiValore(AzionePeso), 0.0f, 1.0f);

	if (TempoCaduta > 0.0f)
	{
		TempoCaduta -= DeltaSeconds;
		if (TempoCaduta <= 0.0f)
		{
			Riparti();
		}
	}
	else
	{
		// Fisica in passi piccoli (1/100 di secondo) per restare stabile
		const float Dt = FMath::Min(DeltaSeconds, 0.05f);
		const int32 Passi = FMath::Max(1, FMath::CeilToInt(Dt / 0.01f));
		for (int32 i = 0; i < Passi && TempoCaduta <= 0.0f; i++)
		{
			Fisica(Dt / Passi);
		}
		TempoDaPartenza += Dt;
	}
	AggiornaGrafica(DeltaSeconds);
}
