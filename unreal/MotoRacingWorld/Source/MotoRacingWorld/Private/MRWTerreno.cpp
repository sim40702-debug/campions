#include "MRWTerreno.h"

#include "Dom/JsonObject.h"
#include "Engine/CollisionProfile.h"
#include "Engine/Texture2D.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"
#include "HAL/FileManager.h"
#include "ImageUtils.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/Material.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "ProceduralMeshComponent.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

// Una foto aerea copre 2 km = 508 quadratini della griglia
static const int32 QUAD_FOTO = 508;
// Un pezzo di terreno dettagliato = 127 quadratini (500 m), 4 x 4 pezzi per foto
static const int32 QUAD_VICINO = 127;
// Terreno lontano: un punto ogni 4
static const int32 SALTO_LONTANO = 4;

// Strade che non si guidano (sentieri, scale...): non le disegno
static bool StradaDaSaltare(const FString& Tipo)
{
	return Tipo == TEXT("footway") || Tipo == TEXT("path") || Tipo == TEXT("steps") ||
		Tipo == TEXT("bridleway") || Tipo == TEXT("corridor") || Tipo == TEXT("proposed") ||
		Tipo == TEXT("construction") || Tipo == TEXT("elevator") || Tipo == TEXT("platform");
}

// Aggiunge un triangolo girato in modo che si veda da sopra
static void AggiungiTriangolo(const TArray<FVector>& Vertici, TArray<int32>& Triangoli, int32 A, int32 B, int32 C)
{
	const FVector Normale = FVector::CrossProduct(Vertici[B] - Vertici[A], Vertici[C] - Vertici[A]);
	if (Normale.Z >= 0.0f)
	{
		Triangoli.Add(A); Triangoli.Add(B); Triangoli.Add(C);
	}
	else
	{
		Triangoli.Add(A); Triangoli.Add(C); Triangoli.Add(B);
	}
}

AMRWTerreno::AMRWTerreno()
{
	PrimaryActorTick.bCanEverTick = true;

	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Radice"));

	TerrenoLontano = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("TerrenoLontano"));
	TerrenoLontano->SetupAttachment(RootComponent);
	TerrenoLontano->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	Strade = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("Strade"));
	Strade->SetupAttachment(RootComponent);
	Strade->bUseAsyncCooking = true;
	Strade->SetCollisionProfileName(UCollisionProfile::BlockAll_ProfileName);

	Lago = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("Lago"));
	Lago->SetupAttachment(RootComponent);
	Lago->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}

void AMRWTerreno::BeginPlay()
{
	Super::BeginPlay();
	SetActorLocation(FVector::ZeroVector);

	const FString Cartella = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir() / TEXT("Dati"));
	if (!LeggiTerreno(Cartella))
	{
		UE_LOG(LogTemp, Error, TEXT("[MRW] %s"), *Errore);
		return;
	}
	LeggiStrade(Cartella);
	LeggiFoto(Cartella);

	CreaTerrenoLontano();
	CreaStrade();
	CreaLago();
	bPronto = true;
	AggiornaTerrenoVicino();
	UE_LOG(LogTemp, Log, TEXT("[MRW] Terreno %d x %d punti, %d strade, %d foto"), Colonne, Righe, ListaStrade.Num(), Foto.Num());
}

bool AMRWTerreno::LeggiTerreno(const FString& Cartella)
{
	FString Testo;
	if (!FFileHelper::LoadFileToString(Testo, *(Cartella / TEXT("terreno.json"))))
	{
		Errore = TEXT("Mancano i dati in ") + Cartella + TEXT(": lancia Content/Python/mrw_scarica_dati.py");
		return false;
	}
	TSharedPtr<FJsonObject> Info;
	TSharedRef<TJsonReader<>> Lettore = TJsonReaderFactory<>::Create(Testo);
	if (!FJsonSerializer::Deserialize(Lettore, Info) || !Info.IsValid())
	{
		Errore = TEXT("terreno.json non valido");
		return false;
	}

	Colonne = Info->GetIntegerField(TEXT("colonne"));
	Righe = Info->GetIntegerField(TEXT("righe"));
	PassoM = Info->GetNumberField(TEXT("passo_m"));
	MetaX = Info->GetNumberField(TEXT("lato_x_m")) / 2.0f;
	MetaY = Info->GetNumberField(TEXT("lato_z_m")) / 2.0f;
	const float QuotaBase = Info->GetNumberField(TEXT("quota_base"));
	const float ScalaQuota = Info->GetNumberField(TEXT("scala_quota"));
	double QuotaLago = 193.3;
	Info->TryGetNumberField(TEXT("livello_lago"), QuotaLago);
	LivelloLago = QuotaLago;

	TArray<uint8> Byte;
	if (!FFileHelper::LoadFileToArray(Byte, *(Cartella / TEXT("terreno.bin"))) || Byte.Num() != Colonne * Righe * 2)
	{
		Errore = TEXT("terreno.bin mancante o di misura sbagliata");
		return false;
	}

	// Ogni quota e' un numero a 16 bit (little endian): quota = base + valore * scala
	Quote.SetNum(Colonne * Righe);
	for (int32 i = 0; i < Quote.Num(); i++)
	{
		const int32 Valore = Byte[i * 2] | (Byte[i * 2 + 1] << 8);
		Quote[i] = QuotaBase + Valore * ScalaQuota;
	}
	return true;
}

void AMRWTerreno::LeggiStrade(const FString& Cartella)
{
	FString Testo;
	if (!FFileHelper::LoadFileToString(Testo, *(Cartella / TEXT("strade.json"))))
	{
		return;
	}
	TSharedPtr<FJsonObject> Dati;
	TSharedRef<TJsonReader<>> Lettore = TJsonReaderFactory<>::Create(Testo);
	if (!FJsonSerializer::Deserialize(Lettore, Dati) || !Dati.IsValid())
	{
		return;
	}

	for (const TSharedPtr<FJsonValue>& Valore : Dati->GetArrayField(TEXT("strade")))
	{
		const TSharedPtr<FJsonObject> Voce = Valore->AsObject();
		FMRWStrada Strada;
		Strada.Nome = Voce->GetStringField(TEXT("n"));
		Strada.Tipo = Voce->GetStringField(TEXT("t"));
		if (StradaDaSaltare(Strada.Tipo))
		{
			continue;
		}
		Strada.Ponte = Voce->GetBoolField(TEXT("b"));
		Strada.Galleria = Voce->GetBoolField(TEXT("g"));
		const float Larghezza = Voce->GetNumberField(TEXT("w")) * 100.0f;

		// "p" = x, quota, z (metri) uno dopo l'altro. In Unreal: X = x, Y = z, Z = quota
		const TArray<TSharedPtr<FJsonValue>>& P = Voce->GetArrayField(TEXT("p"));
		for (int32 i = 0; i + 2 < P.Num(); i += 3)
		{
			Strada.Punti.Add(FVector(P[i]->AsNumber(), P[i + 2]->AsNumber(), P[i + 1]->AsNumber()) * 100.0f);
			Strada.Larghezze.Add(Larghezza);
		}

		// "ww" = larghezze punto per punto dove le case stringono la strada
		const TArray<TSharedPtr<FJsonValue>>* Strette = nullptr;
		if (Voce->TryGetArrayField(TEXT("ww"), Strette))
		{
			for (int32 i = 0; i < Strada.Larghezze.Num() && i < Strette->Num(); i++)
			{
				Strada.Larghezze[i] = (*Strette)[i]->AsNumber() * 100.0f;
			}
		}
		if (Strada.Punti.Num() >= 2)
		{
			ListaStrade.Add(Strada);
		}
	}
}

void AMRWTerreno::LeggiFoto(const FString& Cartella)
{
	const int32 FotoX = (Colonne - 1) / QUAD_FOTO;
	const int32 FotoY = (Righe - 1) / QUAD_FOTO;
	for (int32 y = 0; y < FotoY; y++)
	{
		for (int32 x = 0; x < FotoX; x++)
		{
			const FString Percorso = Cartella / FString::Printf(TEXT("foto/foto_x%d_y%d.jpg"), x, y);
			if (!FPaths::FileExists(Percorso))
			{
				continue;
			}
			UTexture2D* Texture = FImageUtils::ImportFileAsTexture2D(Percorso);
			if (Texture != nullptr)
			{
				Foto.Add(FIntPoint(x, y), Texture);
			}
		}
	}
}

UMaterialInterface* AMRWTerreno::MaterialeFoto(int32 FotoX, int32 FotoY)
{
	const FIntPoint Chiave(FotoX, FotoY);
	if (TObjectPtr<UMaterialInterface>* Trovato = MaterialiFoto.Find(Chiave))
	{
		return *Trovato;
	}
	UMaterialInterface* Base = MaterialeTerreno ? MaterialeTerreno.Get() : UMaterial::GetDefaultMaterial(MD_Surface);
	UMaterialInterface* Risultato = Base;
	if (TObjectPtr<UTexture2D>* Texture = Foto.Find(Chiave))
	{
		UMaterialInstanceDynamic* Istanza = UMaterialInstanceDynamic::Create(Base, this);
		Istanza->SetTextureParameterValue(TEXT("Foto"), *Texture);
		Risultato = Istanza;
	}
	MaterialiFoto.Add(Chiave, Risultato);
	return Risultato;
}

float AMRWTerreno::QuotaGriglia(int32 Colonna, int32 Riga) const
{
	Colonna = FMath::Clamp(Colonna, 0, Colonne - 1);
	Riga = FMath::Clamp(Riga, 0, Righe - 1);
	return Quote[Riga * Colonne + Colonna];
}

FVector AMRWTerreno::PuntoGriglia(int32 Colonna, int32 Riga) const
{
	return FVector(-MetaX + Colonna * PassoM, -MetaY + Riga * PassoM, QuotaGriglia(Colonna, Riga)) * 100.0f;
}

float AMRWTerreno::QuotaTerreno(float X, float Y) const
{
	if (!bPronto)
	{
		return 0.0f;
	}
	// Media tra i 4 punti vicini (come quotaTerreno nell'anteprima)
	const float Colonna = FMath::Clamp((X / 100.0f + MetaX) / PassoM, 0.0f, Colonne - 1.001f);
	const float Riga = FMath::Clamp((Y / 100.0f + MetaY) / PassoM, 0.0f, Righe - 1.001f);
	const int32 C0 = FMath::FloorToInt(Colonna);
	const int32 R0 = FMath::FloorToInt(Riga);
	const float Fx = Colonna - C0;
	const float Fy = Riga - R0;
	const float Sopra = FMath::Lerp(QuotaGriglia(C0, R0), QuotaGriglia(C0 + 1, R0), Fx);
	const float Sotto = FMath::Lerp(QuotaGriglia(C0, R0 + 1), QuotaGriglia(C0 + 1, R0 + 1), Fx);
	return FMath::Lerp(Sopra, Sotto, Fy) * 100.0f;
}

void AMRWTerreno::CostruisciPezzo(int32 Colonna0, int32 Riga0, int32 Quad, int32 Salto, float Abbassa,
	TArray<FVector>& Vertici, TArray<int32>& Triangoli, TArray<FVector>& Normali, TArray<FVector2D>& UV) const
{
	const int32 Lato = Quad / Salto + 1;
	// Posizione del pezzo dentro la sua foto aerea (per le coordinate UV)
	const int32 InizioFotoC = (Colonna0 / QUAD_FOTO) * QUAD_FOTO;
	const int32 InizioFotoR = (Riga0 / QUAD_FOTO) * QUAD_FOTO;

	for (int32 r = 0; r < Lato; r++)
	{
		for (int32 c = 0; c < Lato; c++)
		{
			const int32 Colonna = Colonna0 + c * Salto;
			const int32 Riga = Riga0 + r * Salto;
			FVector Punto = PuntoGriglia(Colonna, Riga);
			Punto.Z -= Abbassa;
			Vertici.Add(Punto);

			// Normale dalla pendenza (differenza tra i punti a destra/sinistra e sopra/sotto)
			const float DzX = QuotaGriglia(Colonna + 1, Riga) - QuotaGriglia(Colonna - 1, Riga);
			const float DzY = QuotaGriglia(Colonna, Riga + 1) - QuotaGriglia(Colonna, Riga - 1);
			Normali.Add(FVector(-DzX, -DzY, 2.0f * PassoM).GetSafeNormal());

			UV.Add(FVector2D(float(Colonna - InizioFotoC) / QUAD_FOTO, float(Riga - InizioFotoR) / QUAD_FOTO));
		}
	}
	for (int32 r = 0; r + 1 < Lato; r++)
	{
		for (int32 c = 0; c + 1 < Lato; c++)
		{
			const int32 i = r * Lato + c;
			AggiungiTriangolo(Vertici, Triangoli, i, i + 1, i + Lato);
			AggiungiTriangolo(Vertici, Triangoli, i + 1, i + Lato + 1, i + Lato);
		}
	}
}

void AMRWTerreno::CreaTerrenoLontano()
{
	// Una sezione per ogni foto aerea (2 x 2 km), abbassata di 2 m:
	// dove c'e' il terreno dettagliato, quello lontano resta sotto e non si vede
	const int32 FotoX = (Colonne - 1) / QUAD_FOTO;
	const int32 FotoY = (Righe - 1) / QUAD_FOTO;
	int32 Sezione = 0;
	for (int32 y = 0; y < FotoY; y++)
	{
		for (int32 x = 0; x < FotoX; x++)
		{
			TArray<FVector> Vertici, Normali;
			TArray<int32> Triangoli;
			TArray<FVector2D> UV;
			CostruisciPezzo(x * QUAD_FOTO, y * QUAD_FOTO, QUAD_FOTO, SALTO_LONTANO, 200.0f, Vertici, Triangoli, Normali, UV);
			TerrenoLontano->CreateMeshSection_LinearColor(Sezione, Vertici, Triangoli, Normali, UV,
				TArray<FLinearColor>(), TArray<FProcMeshTangent>(), false);
			TerrenoLontano->SetMaterial(Sezione, MaterialeFoto(x, y));
			Sezione++;
		}
	}
}

void AMRWTerreno::AggiornaTerrenoVicino()
{
	const APawn* Moto = UGameplayStatics::GetPlayerPawn(this, 0);
	if (Moto == nullptr)
	{
		return;
	}
	const FVector Posizione = Moto->GetActorLocation();
	const float LatoPezzo = QUAD_VICINO * PassoM * 100.0f;   // cm
	const int32 PezziX = (Colonne - 1) / QUAD_VICINO;
	const int32 PezziY = (Righe - 1) / QUAD_VICINO;
	const float Raggio = RaggioDettaglioM * 100.0f;

	// 1) Tolgo i pezzi troppo lontani
	TArray<FIntPoint> DaTogliere;
	for (const TPair<FIntPoint, TObjectPtr<UProceduralMeshComponent>>& Pezzo : PezziVicini)
	{
		const FVector Centro((Pezzo.Key.X + 0.5f) * LatoPezzo - MetaX * 100.0f, (Pezzo.Key.Y + 0.5f) * LatoPezzo - MetaY * 100.0f, 0.0f);
		if (FVector::Dist2D(Centro, Posizione) > Raggio + LatoPezzo * 1.5f)
		{
			DaTogliere.Add(Pezzo.Key);
		}
	}
	for (const FIntPoint& Chiave : DaTogliere)
	{
		PezziVicini[Chiave]->DestroyComponent();
		PezziVicini.Remove(Chiave);
	}

	// 2) Creo i pezzi mancanti vicino alla moto (al massimo 2 per volta, per non bloccare il gioco)
	int32 Creati = 0;
	const int32 CentroX = FMath::FloorToInt((Posizione.X + MetaX * 100.0f) / LatoPezzo);
	const int32 CentroY = FMath::FloorToInt((Posizione.Y + MetaY * 100.0f) / LatoPezzo);
	const int32 Giri = FMath::CeilToInt(Raggio / LatoPezzo) + 1;
	for (int32 Distanza = 0; Distanza <= Giri && Creati < 2; Distanza++)
	{
		for (int32 py = CentroY - Distanza; py <= CentroY + Distanza && Creati < 2; py++)
		{
			for (int32 px = CentroX - Distanza; px <= CentroX + Distanza && Creati < 2; px++)
			{
				// Solo l'anello a questa distanza (i pezzi piu' vicini prima)
				if (FMath::Max(FMath::Abs(px - CentroX), FMath::Abs(py - CentroY)) != Distanza)
				{
					continue;
				}
				if (px < 0 || py < 0 || px >= PezziX || py >= PezziY || PezziVicini.Contains(FIntPoint(px, py)))
				{
					continue;
				}
				const FVector Centro((px + 0.5f) * LatoPezzo - MetaX * 100.0f, (py + 0.5f) * LatoPezzo - MetaY * 100.0f, 0.0f);
				if (FVector::Dist2D(Centro, Posizione) > Raggio + LatoPezzo * 0.75f)
				{
					continue;
				}

				TArray<FVector> Vertici, Normali;
				TArray<int32> Triangoli;
				TArray<FVector2D> UV;
				CostruisciPezzo(px * QUAD_VICINO, py * QUAD_VICINO, QUAD_VICINO, 1, 0.0f, Vertici, Triangoli, Normali, UV);

				UProceduralMeshComponent* Pezzo = NewObject<UProceduralMeshComponent>(this);
				Pezzo->bUseAsyncCooking = true;
				Pezzo->SetupAttachment(RootComponent);
				Pezzo->RegisterComponent();
				Pezzo->SetCollisionProfileName(UCollisionProfile::BlockAll_ProfileName);
				Pezzo->CreateMeshSection_LinearColor(0, Vertici, Triangoli, Normali, UV,
					TArray<FLinearColor>(), TArray<FProcMeshTangent>(), true);
				Pezzo->SetMaterial(0, MaterialeFoto(px * QUAD_VICINO / QUAD_FOTO, py * QUAD_VICINO / QUAD_FOTO));
				PezziVicini.Add(FIntPoint(px, py), Pezzo);
				Creati++;
			}
		}
	}
}

void AMRWTerreno::CreaStrade()
{
	// Le strade sono raggruppate per foto aerea (una sezione ogni 2 x 2 km)
	TMap<int32, int32> SezionePerZona;
	TArray<TArray<FVector>> Vertici, Normali;
	TArray<TArray<int32>> Triangoli;
	TArray<TArray<FVector2D>> UV;
	const float LatoFoto = QUAD_FOTO * PassoM * 100.0f;
	const int32 FotoX = FMath::Max(1, (Colonne - 1) / QUAD_FOTO);

	for (const FMRWStrada& Strada : ListaStrade)
	{
		const FVector& Primo = Strada.Punti[0];
		const int32 ZonaX = FMath::Max(0, FMath::FloorToInt((Primo.X + MetaX * 100.0f) / LatoFoto));
		const int32 ZonaY = FMath::Max(0, FMath::FloorToInt((Primo.Y + MetaY * 100.0f) / LatoFoto));
		const int32 Zona = ZonaY * FotoX + ZonaX;
		if (!SezionePerZona.Contains(Zona))
		{
			SezionePerZona.Add(Zona, Vertici.Num());
			Vertici.AddDefaulted();
			Normali.AddDefaulted();
			Triangoli.AddDefaulted();
			UV.AddDefaulted();
		}
		const int32 S = SezionePerZona[Zona];
		const int32 Inizio = Vertici[S].Num();

		// Nastro: per ogni punto, un vertice a sinistra e uno a destra
		float Distanza = 0.0f;
		const int32 N = Strada.Punti.Num();
		for (int32 i = 0; i < N; i++)
		{
			const FVector& Prima = Strada.Punti[FMath::Max(i - 1, 0)];
			const FVector& Dopo = Strada.Punti[FMath::Min(i + 1, N - 1)];
			const FVector Direzione = FVector(Dopo.X - Prima.X, Dopo.Y - Prima.Y, 0.0f).GetSafeNormal();
			const FVector Lato(-Direzione.Y, Direzione.X, 0.0f);
			const float MezzaLarghezza = Strada.Larghezze[i] / 2.0f;
			if (i > 0)
			{
				Distanza += FVector::Dist(Strada.Punti[i], Strada.Punti[i - 1]);
			}
			Vertici[S].Add(Strada.Punti[i] - Lato * MezzaLarghezza);
			Vertici[S].Add(Strada.Punti[i] + Lato * MezzaLarghezza);
			Normali[S].Add(FVector::UpVector);
			Normali[S].Add(FVector::UpVector);
			UV[S].Add(FVector2D(0.0f, Distanza / 400.0f));
			UV[S].Add(FVector2D(1.0f, Distanza / 400.0f));
		}
		for (int32 i = 0; i + 1 < N; i++)
		{
			const int32 A = Inizio + i * 2;
			AggiungiTriangolo(Vertici[S], Triangoli[S], A, A + 1, A + 2);
			AggiungiTriangolo(Vertici[S], Triangoli[S], A + 1, A + 3, A + 2);
		}
	}

	UMaterialInterface* Asfalto = MaterialeStrada ? MaterialeStrada.Get() : UMaterial::GetDefaultMaterial(MD_Surface);
	for (int32 S = 0; S < Vertici.Num(); S++)
	{
		Strade->CreateMeshSection_LinearColor(S, Vertici[S], Triangoli[S], Normali[S], UV[S],
			TArray<FLinearColor>(), TArray<FProcMeshTangent>(), true);
		Strade->SetMaterial(S, Asfalto);
	}
}

void AMRWTerreno::CreaLago()
{
	// Un grande piano alla quota del lago: si vede solo dove il terreno e' piu' basso
	const float Z = LivelloLago * 100.0f;
	const float X = MetaX * 100.0f;
	const float Y = MetaY * 100.0f;
	TArray<FVector> Vertici = { FVector(-X, -Y, Z), FVector(X, -Y, Z), FVector(-X, Y, Z), FVector(X, Y, Z) };
	TArray<int32> Triangoli;
	AggiungiTriangolo(Vertici, Triangoli, 0, 1, 2);
	AggiungiTriangolo(Vertici, Triangoli, 1, 3, 2);
	TArray<FVector> Normali = { FVector::UpVector, FVector::UpVector, FVector::UpVector, FVector::UpVector };
	TArray<FVector2D> UV = { FVector2D(0, 0), FVector2D(1, 0), FVector2D(0, 1), FVector2D(1, 1) };
	Lago->CreateMeshSection_LinearColor(0, Vertici, Triangoli, Normali, UV,
		TArray<FLinearColor>(), TArray<FProcMeshTangent>(), false);
	if (MaterialeAcqua)
	{
		Lago->SetMaterial(0, MaterialeAcqua);
	}
}

bool AMRWTerreno::PuntoStradaVicino(const FVector& Vicino, FVector& Punto, FVector& Direzione) const
{
	float Migliore = TNumericLimits<float>::Max();
	bool Trovato = false;
	for (const FMRWStrada& Strada : ListaStrade)
	{
		// In galleria no: meglio ripartire all'aperto
		if (Strada.Galleria)
		{
			continue;
		}
		for (int32 i = 0; i + 1 < Strada.Punti.Num(); i++)
		{
			const float Distanza = FVector::DistSquared2D(Strada.Punti[i], Vicino);
			if (Distanza < Migliore)
			{
				Migliore = Distanza;
				Punto = Strada.Punti[i];
				Direzione = (Strada.Punti[i + 1] - Strada.Punti[i]).GetSafeNormal2D();
				Trovato = true;
			}
		}
	}
	return Trovato;
}

void AMRWTerreno::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!bPronto)
	{
		return;
	}
	TempoAggiornamento -= DeltaSeconds;
	if (TempoAggiornamento <= 0.0f)
	{
		TempoAggiornamento = 0.25f;
		AggiornaTerrenoVicino();
	}
}
